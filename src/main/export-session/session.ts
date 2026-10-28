// Step 4 of the Home page in main: the template, the loaded table and the stored mapping meet the export options here.
// Pure Node: the storage and the table are passed in, so the logic is testable without Electron.
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type {
  ExampleRequest,
  ExampleResult,
  ExportField,
  FailureCode,
  OpenedExport,
  SavedPattern,
} from "../../shared/ipc/export";
import type { DataTable } from "../data";
import { maxNameLength, planFileNames, sanitizeName, validatePattern } from "../export/filename";
import { toProfile, toRecord } from "../mapping";
import { DEFAULT_FILENAME_PATTERN, type Storage, type Template } from "../storage";
import { buildRows } from "./rows";

export const EXTENSION = ".docx";

export type SessionDeps = {
  storage: () => Promise<Storage>;
  table: () => DataTable | undefined;
  /** Where files go when no folder was used before (or it is gone). */
  defaultFolder: () => string;
  now?: () => Date;
};

type Fail = { ok: false; code: FailureCode };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `<template name> <yyyy-mm-dd>.zip`, sanitized with the filename rules. An existing name is numbered by `exportZip`. */
export function zipNameFor(templateName: string, date: Date): string {
  return `${sanitizeName(`${templateName} ${isoDay(date)}`)}.zip`;
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

export class ExportSession {
  constructor(private readonly deps: SessionDeps) {}

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
    const choices = await (await this.deps.storage()).getChoices();
    const fields: ExportField[] = template.tags.map((t) => ({ key: t.name, label: t.label }));
    return {
      ok: true,
      view: {
        templateName: template.name,
        fields,
        pattern: effectivePattern(template),
        removeDiacritics: choices.removeDiacritics,
        folder: await this.folder(),
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
}
