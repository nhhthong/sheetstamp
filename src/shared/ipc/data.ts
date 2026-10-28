// IPC channels of the "data" feature, handled in src/main/ipc/data.ts.
// The table itself stays in main memory (src/main/data-session); the renderer only sees a snapshot of it.
import { SELECTABLE_ENCODINGS, type TextEncodingName } from "../../main/data/encoding";
import type { DataWarning } from "../../main/data/scan";
import { channel, integer, nothing, oneOf, record, string } from "./define";

export type { DataWarning, TextEncodingName };
export const ENCODING_CHOICES = SELECTABLE_ENCODINGS;

/** A scan warning plus where the column sits; an ID warning also carries the suggested zero-padding width. */
export type SnapshotWarning = DataWarning & { columnIndex: number; suggestedWidth?: number };

/** What the renderer may know about the loaded table. Rows beyond the preview never leave main. */
export type DataSnapshot = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  /** The first five rows, as text. */
  previewRows: string[][];
  /** CSV only. The encoding the text was read with. */
  encoding?: TextEncodingName;
  /** `.xlsx` only. Every sheet name, and the one being read. */
  sheets: string[];
  sheet?: string;
  warnings: SnapshotWarning[];
  /** Column indexes the user padded with zeros in this session. */
  paddedColumns: number[];
  /** True when the file on disk differs from what was read (size or modified time). */
  changedOnDisk: boolean;
};

/** `code` is a `DataErrorCode` or a code of the session itself. `message` is Vietnamese when main has one. */
export type DataFailure = {
  code: string;
  message?: string;
};

export type DataResult =
  | { ok: true; snapshot: DataSnapshot }
  | { ok: false; error: DataFailure }
  | { ok: false; canceled: true };

export type DataQuery = { snapshot: DataSnapshot | null };

const MAX_PATH = 4096;

/** Open a file by absolute path (a dropped file; the path comes from `window.sheetstamp.pathForFile`). */
export const openPath = channel<{ path: string }, DataResult>("data:open-path", (value) => {
  const raw = record(value, "open request");
  return { path: string(raw.path, "path", { min: 1, max: MAX_PATH }) };
});

/** Show the native open dialog (csv, xlsx), then open the chosen file. */
export const pickFile = channel<undefined, DataResult>("data:pick-file", nothing);

export const setEncoding = channel<{ encoding: TextEncodingName }, DataResult>(
  "data:set-encoding",
  (value) => ({
    encoding: oneOf(record(value, "encoding request").encoding, "encoding", ENCODING_CHOICES),
  }),
);

export const setSheet = channel<{ sheet: string }, DataResult>("data:set-sheet", (value) => ({
  sheet: string(record(value, "sheet request").sheet, "sheet", { min: 1, max: 255 }),
}));

export const padColumn = channel<{ columnIndex: number; width: number }, DataResult>(
  "data:pad-column",
  (value) => {
    const raw = record(value, "pad request");
    return {
      columnIndex: integer(raw.columnIndex, "columnIndex", { min: 0, max: 16_383 }),
      width: integer(raw.width, "width", { min: 1, max: 64 }),
    };
  },
);

/** Read the file again from disk, keeping the chosen sheet and encoding where they still apply. */
export const reload = channel<undefined, DataResult>("data:reload", nothing);

/** Forget the table. */
export const clear = channel<undefined, DataQuery>("data:clear", nothing);

/** The current snapshot, or null when nothing is loaded (always after a restart). */
export const current = channel<undefined, DataQuery>("data:current", nothing);

export const channels = [
  openPath,
  pickFile,
  setEncoding,
  setSheet,
  padColumn,
  reload,
  clear,
  current,
] as const;
export const events = [] as const;
