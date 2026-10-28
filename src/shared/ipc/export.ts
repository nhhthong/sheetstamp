// IPC channels of the "export" feature (Home step 4). Handlers: src/main/ipc/export.ts, logic: src/main/export-session.
// Nothing here carries a cell of the data: names are built and files written in main.
import {
  type Channel,
  channel,
  type EventChannel,
  eventChannel,
  IpcValidationError,
  nothing,
  oneOf,
  record,
  string,
} from "./define";

/** What `validatePattern` found, as plain data. The renderer words it in Vietnamese. */
export type PatternProblemView =
  | { kind: "empty" }
  | { kind: "path-characters"; text: string }
  | { kind: "unknown-field"; key: string };

export const FAILURE_CODES = [
  "invalid-pattern",
  "no-data",
  "no-template",
  "busy",
  "bad-folder",
  "write-failed",
  "unknown",
] as const;
export type FailureCode = (typeof FAILURE_CODES)[number];

export type ExportField = { key: string; label: string };

/** What step 4 needs to draw itself. */
export type ExportView = {
  templateName: string;
  fields: ExportField[];
  /** The stored pattern with `{{key}}` tags (the default `{{ten}}` falls back to the first field). */
  pattern: string;
  removeDiacritics: boolean;
  /** The folder files go to: the last one used, else the documents folder. */
  folder: string;
  rowCount: number;
};

export type OpenedExport = { ok: true; view: ExportView } | { ok: false; code: FailureCode };

const MAX_PATTERN = 500;
const idOf = (value: unknown) =>
  string(record(value).templateId, "templateId", { min: 1, max: 200 });
const patternOf = (value: unknown) =>
  string(record(value).pattern, "pattern", { max: MAX_PATTERN });
const flagOf = (value: unknown) => {
  const flag = record(value).removeDiacritics;
  if (typeof flag !== "boolean") throw new IpcValidationError("removeDiacritics must be a boolean");
  return flag;
};

/** Load step 4: the template, the fields, the pattern, the remembered options. */
export const openExport: Channel<{ templateId: string }, OpenedExport> = channel(
  "export:open",
  (value) => ({ templateId: idOf(value) }),
);

export type ExampleRequest = { templateId: string; pattern: string; removeDiacritics: boolean };
export type ExampleResult =
  | { ok: true; problems: PatternProblemView[]; example: string | null }
  | { ok: false; code: FailureCode };

/** The file name the pattern gives for the first row (sanitized, with its extension), or the problems with the pattern. */
export const example: Channel<ExampleRequest, ExampleResult> = channel(
  "export:example",
  (value) => ({
    templateId: idOf(value),
    pattern: patternOf(value),
    removeDiacritics: flagOf(value),
  }),
);

export type PickedFolder =
  | { ok: true; folder: string }
  | { ok: false; canceled: true }
  | { ok: false; canceled?: false; code: "bad-folder" };

/** The operating system's folder picker, opened at the last folder. The choice is remembered. */
export const pickFolder: Channel<undefined, PickedFolder> = channel("export:pickFolder", nothing);

/** Remember the "Bỏ dấu" choice. */
export const setDiacritics: Channel<{ removeDiacritics: boolean }, void> = channel(
  "export:setDiacritics",
  (value) => ({ removeDiacritics: flagOf(value) }),
);

export type SavedPattern = { ok: true } | { ok: false; code: FailureCode };

/** Save the pattern into the template ("Lưu mẫu tên này vào mẫu"). Checked in main. */
export const savePattern: Channel<{ templateId: string; pattern: string }, SavedPattern> = channel(
  "export:savePattern",
  (value) => ({ templateId: idOf(value), pattern: patternOf(value) }),
);

export type ExportDone = {
  zipPath: string | null;
  written: number;
  failed: number;
  /** Whether a CSV error report exists next to the ZIP. */
  hasReport: boolean;
};

export type StartResult =
  | { ok: true; done: ExportDone }
  | { ok: false; canceled: true }
  | { ok: false; canceled?: false; code: FailureCode };

/**
 * Generate every row and write the ZIP. The call returns when the export ends. The data, the mapping and the
 * folder are read in main; the request only carries what the user typed (the pattern and the option).
 */
export const start: Channel<ExampleRequest, StartResult> = channel("export:start", (value) => ({
  templateId: idOf(value),
  pattern: patternOf(value),
  removeDiacritics: flagOf(value),
}));

/** Stop the running export. Nothing is saved: no ZIP, no temporary file. */
export const cancel: Channel<undefined, void> = channel("export:cancel", nothing);

/** Show the ZIP or the error report of the last export in the file manager, selected. The path never comes from the renderer. */
export const reveal: Channel<{ what: "zip" | "report" }, { ok: boolean }> = channel(
  "export:reveal",
  (value) => ({ what: oneOf(record(value).what, "what", ["zip", "report"] as const) }),
);

export type ExportProgress = { done: number; total: number; failed: number };

/** At most about ten a second, however many rows there are. */
export const progress: EventChannel<ExportProgress> = eventChannel("export:progress");

/** "Tạo đợt mới": forget the loaded data (it lives only in memory in main). */
export const resetData: Channel<undefined, void> = channel("export:resetData", nothing);

export const channels = [
  resetData,
  openExport,
  example,
  pickFolder,
  setDiacritics,
  savePattern,
  start,
  cancel,
  reveal,
] as const;
export const events = [progress] as const;
