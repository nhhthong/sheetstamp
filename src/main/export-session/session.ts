// Step 4 of the Home page in main: the template, the loaded table and the stored mapping meet the export here.
// Pure Node: the storage, the table, the batch runner and the progress sink are passed in, so it is testable
// without Electron and without a worker.
import { stat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import type {
  ExampleRequest,
  ExampleResult,
  ExportField,
  ExportProgress,
  FailureCode,
  OpenedExport,
  SavedPattern,
  StartResult,
} from "../../shared/ipc/export";
import type { DataTable } from "../data";
import type { BatchRequest } from "../export/batch";
import {
  maxNameLength,
  planFileNames,
  sanitizeName,
  truncate,
  validatePattern,
} from "../export/filename";
import { ExportCancelledError, type ExportResult, sweepStaleTemps } from "../export/zip";
import { toProfile, toRecord } from "../mapping";
import { DEFAULT_FILENAME_PATTERN, type Storage, type Template } from "../storage";
import { buildRows } from "./rows";
import { throttle } from "./throttle";

const PROGRESS_INTERVAL_MS = 100;
const EXTENSION = ".docx";

export type SessionDeps = {
  storage: () => Promise<Storage>;
  table: () => DataTable | undefined;
  /** Run the batch (in production: `runBatch` bound to the worker file). */
  run: (request: BatchRequest) => Promise<ExportResult>;
  /** Where files go when no folder was used before (or it is gone). */
  defaultFolder: () => string;
  onProgress: (progress: ExportProgress) => void;
  now?: () => Date;
  /** Worker count, for tests. Default: `defaultPoolSize()`. */
  poolSize?: number;
};

type Fail = { ok: false; code: FailureCode };

const ZIP_BASE_MAX_CHARS = 100;
const ZIP_BASE_MAX_BYTES = 200;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `<template name> <yyyy-mm-dd>.zip`, sanitized with the filename rules. An existing name is numbered by `exportZip`. */
export function zipNameFor(templateName: string, date: Date): string {
  const day = isoDay(date);
  // About 100 characters and 200 UTF-8 bytes, cut at grapheme boundaries, so no file system refuses the final name
  // (255 bytes on most) after every row was done. The date always stays.
  const name = truncate(
    sanitizeName(templateName),
    ZIP_BASE_MAX_CHARS - day.length - 1,
    ZIP_BASE_MAX_BYTES - day.length - 1,
  );
  return `${sanitizeName(`${name} ${day}`)}.zip`;
}

/** The stored default `{{ten}}` falls back to the first field when the template has no `ten`. */
export function effectivePattern(template: Pick<Template, "filenamePattern" | "tags">): string {
  const keys = template.tags.map((t) => t.name);
  if (template.filenamePattern === DEFAULT_FILENAME_PATTERN && !keys.includes("ten")) {
    const first = keys[0];
    return first === undefined ? "" : `{{${first}}}`;
  }
  return template.filenamePattern;
}

function classify(error: unknown): FailureCode {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "ENOTDIR")
    return "bad-folder";
  if (code === "ENOSPC" || code === "EROFS" || code === "EIO") return "write-failed";
  return "unknown";
}

export class ExportSession {
  #running = false;
  #controller: AbortController | undefined;
  #waiters: Array<() => void> = [];
  #last: { zipPath: string | null; reportPath: string | null } = {
    zipPath: null,
    reportPath: null,
  };

  constructor(private readonly deps: SessionDeps) {}

  get running(): boolean {
    return this.#running;
  }

  /** Resolves when no export is running (at once when none is). */
  settled(): Promise<void> {
    return this.#running
      ? new Promise((resolve) => this.#waiters.push(resolve))
      : Promise.resolve();
  }

  cancel(): void {
    this.#controller?.abort();
  }

  /** The path to show in the file manager, from the last export; the renderer never names a path. */
  pathToReveal(what: "zip" | "report"): string | null {
    return what === "zip" ? this.#last.zipPath : this.#last.reportPath;
  }

  async #word(templateId: string): Promise<{ template: Template; table: DataTable } | Fail> {
    const table = this.deps.table();
    if (!table) return { ok: false, code: "no-data" };
    const template = await (await this.deps.storage()).getTemplate(templateId);
    if (!template || template.kind !== "word") return { ok: false, code: "no-template" };
    return { template, table };
  }

  /** The remembered folder when it still exists, else the default one. */
  async folder(): Promise<string> {
    const { lastOutputFolder } = await (await this.deps.storage()).getChoices();
    if (lastOutputFolder) {
      const found = await stat(lastOutputFolder).catch(() => undefined);
      if (found?.isDirectory()) return lastOutputFolder;
    }
    return this.deps.defaultFolder();
  }

  /** Remember a folder the user chose. It must be an existing directory. */
  async rememberFolder(folder: string): Promise<boolean> {
    const found = await stat(folder).catch(() => undefined);
    if (!found?.isDirectory()) return false;
    await (await this.deps.storage()).setChoices({ lastOutputFolder: folder });
    return true;
  }

  async open(templateId: string): Promise<OpenedExport> {
    const found = await this.#word(templateId);
    if ("ok" in found) return found;
    const { template, table } = found;
    const storage = await this.deps.storage();
    const choices = await storage.getChoices();
    const fields: ExportField[] = template.tags.map((t) => ({ key: t.name, label: t.label }));
    const folder = await this.folder();
    // A killed process can leave `.sheetstamp-*.tmp` behind: remove the ones older than a day.
    await sweepStaleTemps(folder).catch(() => undefined);
    return {
      ok: true,
      view: {
        templateName: template.name,
        fields,
        pattern: effectivePattern(template),
        removeDiacritics: choices.removeDiacritics,
        folder,
        rowCount: table.rows.length,
      },
    };
  }

  /** The name the pattern gives for the first row, built by the same planner as the export. */
  async example(request: ExampleRequest): Promise<ExampleResult> {
    const found = await this.#word(request.templateId);
    if ("ok" in found) return found;
    const { template, table } = found;
    const keys = template.tags.map((t) => t.name);
    const problems = validatePattern(request.pattern, keys);
    if (problems.length > 0) return { ok: true, problems, example: null };
    const first = buildRows(
      { ...table, rows: table.rows.slice(0, 1) },
      keys,
      toRecord(toProfile(template.mapping)),
    );
    const zipName = zipNameFor(template.name, (this.deps.now ?? (() => new Date()))());
    const [name] = planFileNames(first, request.pattern, {
      extension: EXTENSION,
      removeDiacritics: request.removeDiacritics,
      maxLength: maxNameLength(await this.folder(), basename(zipName, ".zip")),
    });
    return { ok: true, problems: [], example: name ?? null };
  }

  async savePattern(templateId: string, pattern: string): Promise<SavedPattern> {
    const found = await this.#word(templateId);
    if ("ok" in found) return found;
    const keys = found.template.tags.map((t) => t.name);
    if (validatePattern(pattern, keys).length > 0) return { ok: false, code: "invalid-pattern" };
    try {
      await (await this.deps.storage()).updateTemplate(templateId, { filenamePattern: pattern });
    } catch {
      return { ok: false, code: "unknown" };
    }
    return { ok: true };
  }

  /**
   * Generate every row and write the ZIP. One export at a time. The rows, the mapping and the template bytes are
   * copied at the start, so nothing the user does afterwards (a changed file, a changed mapping) reaches this export.
   */
  async start(request: ExampleRequest): Promise<StartResult> {
    if (this.#running) return { ok: false, code: "busy" };
    this.#running = true;
    const controller = new AbortController();
    this.#controller = controller;
    try {
      const found = await this.#word(request.templateId);
      if ("ok" in found) return found;
      const { template, table } = found;
      const keys = template.tags.map((t) => t.name);
      if (validatePattern(request.pattern, keys).length > 0)
        return { ok: false, code: "invalid-pattern" };

      const storage = await this.deps.storage();
      const docx = new Uint8Array(await storage.readSource(template.id));
      const rows = buildRows(table, keys, toRecord(toProfile(template.mapping)));
      const folder = await this.folder();
      const send = throttle(this.deps.onProgress, PROGRESS_INTERVAL_MS);
      send({ done: 0, total: rows.length, failed: 0 });

      this.#last = { zipPath: null, reportPath: null };
      const result = await this.deps.run({
        init: { kind: "word", template: docx },
        rows,
        pattern: request.pattern,
        extension: EXTENSION,
        removeDiacritics: request.removeDiacritics,
        folder,
        zipName: zipNameFor(template.name, (this.deps.now ?? (() => new Date()))()),
        signal: controller.signal,
        onProgress: send,
        poolSize: this.deps.poolSize,
      });

      // An empty ZIP is no result: remove it and say so.
      if (result.written === 0) await unlink(result.zipPath).catch(() => undefined);
      const zipPath = result.written === 0 ? null : result.zipPath;
      this.#last = { zipPath, reportPath: result.reportPath ?? null };
      await storage.setChoices({ lastOutputFolder: folder }).catch(() => undefined);
      if (result.written > 0) await storage.markUsed(template.id).catch(() => undefined);
      return {
        ok: true,
        done: {
          zipPath,
          written: result.written,
          failed: result.failed.length,
          hasReport: result.reportPath !== undefined,
          invalidValues: result.failed.filter((f) => f.code === "invalid-value").length,
          reportFailed: result.reportFailed === true,
        },
      };
    } catch (error) {
      if (error instanceof ExportCancelledError) return { ok: false, canceled: true };
      return { ok: false, code: classify(error) };
    } finally {
      this.#running = false;
      this.#controller = undefined;
      for (const resolve of this.#waiters.splice(0)) resolve();
    }
  }
}
