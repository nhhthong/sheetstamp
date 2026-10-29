// Step 4 of the Home page in main: the template, the loaded table and the stored mapping meet the export here.
// Pure Node: the storage, the table, the batch runner and the progress sink are passed in, so it is testable
// without Electron and without a worker.
import { stat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { parseImageLayout } from "../../shared/image-layout";
import type {
  Estimate,
  ExampleRequest,
  ExampleResult,
  ExportBlocker,
  ExportField,
  ExportProgress,
  FailureCode,
  ImageFormat,
  OpenedExport,
  SavedPattern,
  StartResult,
} from "../../shared/ipc/export";
import type { GenerateInit } from "../../worker/generate-job";
import type { ImageInit } from "../../worker/image-job";
import type { ImageTemplate, OutputFormat, TextBox } from "../../worker/render/types";
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
import { checkImage } from "../templates/image-file";
import { buildRows } from "./rows";
import { throttle } from "./throttle";

const PROGRESS_INTERVAL_MS = 100;
/** Fixed by decision O-16: the user picks PNG or JPG, never the quality. */
const JPG_QUALITY = 90;
/** Rows drawn for the size estimate. Two keep it cheap and show how much the content changes the size. */
const SAMPLE_ROWS = 2;

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
  /** Where the export workers look for fonts (the same folders as the image worker). */
  fonts?: () => ImageInit;
  /** Of these font families, the ones this computer does not have (rescans first). */
  missingFonts?: (families: string[]) => Promise<string[]>;
  /** Bytes of the sample rows drawn in the worker; a row that cannot be drawn is left out. */
  sample?: (
    template: ImageTemplate,
    rows: Record<string, string>[],
    format: OutputFormat,
  ) => Promise<number[]>;
};

type Fail = { ok: false; code: FailureCode };

const outputFormat = (format: ImageFormat): OutputFormat =>
  format === "png" ? { type: "png" } : { type: "jpeg", quality: JPG_QUALITY };

/** The extension of the files in the ZIP; the name planner counts its length in the budget. */
const extensionOf = (template: Template, format: ImageFormat): string =>
  template.kind === "word" ? ".docx" : `.${format}`;

const FAILURE_OF_BLOCKER: Record<ExportBlocker["kind"], FailureCode> = {
  "no-boxes": "no-boxes",
  "bad-template": "bad-template",
  "font-missing": "font-missing",
};

type ImageSetup =
  | { blocker: ExportBlocker }
  | { blocker: null; template: ImageTemplate; backgroundFormat: ImageFormat };

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

  async #loaded(templateId: string): Promise<{ template: Template; table: DataTable } | Fail> {
    const table = this.deps.table();
    if (!table) return { ok: false, code: "no-data" };
    const template = await (await this.deps.storage()).getTemplate(templateId);
    if (!template) return { ok: false, code: "no-template" };
    return { template, table };
  }

  /**
   * An image template as the worker needs it, or what stands in the way: no boxes, a layout or background that
   * cannot be read, a font this computer lacks. Every row would fail on these, so the export refuses up front.
   */
  async #image(template: Template): Promise<ImageSetup> {
    const parsed = parseImageLayout(template.imageLayout ?? { version: 1, boxes: [] });
    if (!parsed.ok) return { blocker: { kind: "bad-template" } };
    if (parsed.layout.boxes.length === 0) return { blocker: { kind: "no-boxes" } };
    const boxes: TextBox[] = parsed.layout.boxes.map(({ id: _id, ...box }) => box);
    let background: Uint8Array;
    try {
      background = new Uint8Array(await (await this.deps.storage()).readSource(template.id));
    } catch {
      return { blocker: { kind: "bad-template" } };
    }
    const checked = checkImage(background);
    if (!checked.ok) return { blocker: { kind: "bad-template" } };
    const families = [...new Set(boxes.map((b) => b.fontFamily))];
    const fonts = (await this.deps.missingFonts?.(families)) ?? [];
    if (fonts.length > 0) return { blocker: { kind: "font-missing", fonts } };
    return {
      blocker: null,
      template: { background, boxes },
      backgroundFormat: checked.info.format === "png" ? "png" : "jpg",
    };
  }

  /** What the user asked for, else what they chose last time, else the background's own format. */
  async #format(requested: ImageFormat | undefined, backgroundFormat: ImageFormat) {
    if (requested) return requested;
    const { imageFormat } = await (await this.deps.storage()).getChoices();
    return imageFormat ?? backgroundFormat;
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
    const found = await this.#loaded(templateId);
    if ("ok" in found) return found;
    const { template, table } = found;
    const storage = await this.deps.storage();
    const choices = await storage.getChoices();
    const fields: ExportField[] = template.tags.map((t) => ({ key: t.name, label: t.label }));
    const folder = await this.folder();
    // A killed process can leave `.sheetstamp-*.tmp` behind: remove the ones older than a day.
    await sweepStaleTemps(folder).catch(() => undefined);
    const image = template.kind === "image" ? await this.#image(template) : undefined;
    return {
      ok: true,
      view: {
        templateName: template.name,
        fields,
        pattern: effectivePattern(template),
        removeDiacritics: choices.removeDiacritics,
        folder,
        rowCount: table.rows.length,
        kind: template.kind,
        imageFormat: await this.#format(
          undefined,
          image && image.blocker === null ? image.backgroundFormat : "png",
        ),
        blocker: image?.blocker ?? null,
      },
    };
  }

  /** The name the pattern gives for the first row, built by the same planner as the export. */
  async example(request: ExampleRequest): Promise<ExampleResult> {
    const found = await this.#loaded(request.templateId);
    if ("ok" in found) return found;
    const { template, table } = found;
    const keys = template.tags.map((t) => t.name);
    const problems = validatePattern(request.pattern, keys);
    if (problems.length > 0) return { ok: true, problems, example: null };
    const first = buildRows(
      { ...table, rows: table.rows.slice(0, 1) },
      keys,
      toRecord(toProfile(template.mapping)),
      template.kind === "word",
    );
    const zipName = zipNameFor(template.name, (this.deps.now ?? (() => new Date()))());
    const [name] = planFileNames(first, request.pattern, {
      extension: extensionOf(template, await this.#imageFormatOf(template, request.imageFormat)),
      removeDiacritics: request.removeDiacritics,
      maxLength: maxNameLength(await this.folder(), basename(zipName, ".zip")),
    });
    return { ok: true, problems: [], example: name ?? null };
  }

  /** The format of an image export; for a Word template it is never read. */
  async #imageFormatOf(
    template: Template,
    requested: ImageFormat | undefined,
  ): Promise<ImageFormat> {
    if (template.kind === "word") return "png";
    if (requested) return requested;
    const image = await this.#image(template);
    return this.#format(requested, image.blocker === null ? image.backgroundFormat : "png");
  }

  /** Size of the whole export, from the first rows drawn for real. An estimate: the other rows differ a little. */
  async estimate(request: { templateId: string; imageFormat: ImageFormat }): Promise<Estimate> {
    const found = await this.#loaded(request.templateId);
    if ("ok" in found) return found;
    const { template, table } = found;
    if (template.kind !== "image" || !this.deps.sample) return { ok: false, code: "no-template" };
    const image = await this.#image(template);
    if (image.blocker) return { ok: false, code: FAILURE_OF_BLOCKER[image.blocker.kind] };
    const keys = template.tags.map((t) => t.name);
    const rows = buildRows(
      { ...table, rows: table.rows.slice(0, SAMPLE_ROWS) },
      keys,
      toRecord(toProfile(template.mapping)),
      false,
    ).map((row) => row.values);
    try {
      const sizes = await this.deps.sample(image.template, rows, outputFormat(request.imageFormat));
      if (sizes.length === 0) return { ok: true, bytes: null };
      const mean = sizes.reduce((sum, n) => sum + n, 0) / sizes.length;
      return { ok: true, bytes: Math.round(mean * table.rows.length) };
    } catch {
      return { ok: false, code: "unknown" };
    }
  }

  async savePattern(templateId: string, pattern: string): Promise<SavedPattern> {
    const found = await this.#loaded(templateId);
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
      const found = await this.#loaded(request.templateId);
      if ("ok" in found) return found;
      const { template, table } = found;
      const keys = template.tags.map((t) => t.name);
      if (validatePattern(request.pattern, keys).length > 0)
        return { ok: false, code: "invalid-pattern" };

      const storage = await this.deps.storage();
      let init: GenerateInit;
      let format: ImageFormat = "png";
      if (template.kind === "word") {
        init = { kind: "word", template: new Uint8Array(await storage.readSource(template.id)) };
      } else {
        const image = await this.#image(template);
        if (image.blocker) {
          const fonts = image.blocker.kind === "font-missing" ? image.blocker.fonts : undefined;
          return {
            ok: false,
            code: FAILURE_OF_BLOCKER[image.blocker.kind],
            ...(fonts ? { fonts } : {}),
          };
        }
        format = await this.#format(request.imageFormat, image.backgroundFormat);
        init = {
          kind: "image",
          template: image.template,
          format: outputFormat(format),
          fonts: this.deps.fonts?.(),
        };
      }
      const rows = buildRows(
        table,
        keys,
        toRecord(toProfile(template.mapping)),
        template.kind === "word",
      );
      const folder = await this.folder();
      const send = throttle(this.deps.onProgress, PROGRESS_INTERVAL_MS);
      send({ done: 0, total: rows.length, failed: 0 });

      this.#last = { zipPath: null, reportPath: null };
      const result = await this.deps.run({
        init,
        rows,
        pattern: request.pattern,
        extension: extensionOf(template, format),
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
