import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import type { DataResult, DataSnapshot, SnapshotWarning } from "../../shared/ipc/data";
import { stripDiacritics } from "../../shared/text/diacritics";
import {
  DataError,
  type DataTable,
  listSheets,
  loadTable,
  MAX_FILE_BYTES,
  padColumn,
  previewRows,
  scanTable,
  type TextEncodingName,
} from "../data";

/** Session codes, besides the `DataErrorCode`s. The renderer words them. */
export type SessionErrorCode = "file-missing" | "read-failed" | "no-file" | "bad-column";

type Source = {
  path: string;
  /** Raw bytes, kept in memory only so that a new encoding or sheet needs no second read. */
  bytes: Uint8Array;
  size: number;
  mtimeMs: number;
  sheets: string[];
};

/** Zero-padding width suggested for a numeric ID column; the user can change it. */
export function suggestWidth(column: string, width: number): number {
  const name = stripDiacritics(column).toLowerCase();
  if (/cccd|can cuoc/.test(name)) return Math.max(12, width);
  if (/cmnd/.test(name)) return Math.max(9, width);
  if (/dien thoai|sdt|phone/.test(name)) return Math.max(10, width);
  if (/ma so thue|\bmst\b/.test(name)) return Math.max(10, width);
  return width;
}

function fail(code: SessionErrorCode | DataError["code"], error?: unknown): DataResult {
  return {
    ok: false,
    error: error instanceof DataError ? { code: error.code, message: error.message } : { code },
  };
}

type Read = { ok: true; source: Source } | { ok: false; result: DataResult };

/**
 * The table the user loaded, held in memory only (never written to disk). One table at a time.
 * Every operation returns a result and never throws; a failed operation leaves the previous table in place.
 */
export class DataSession {
  #source: Source | undefined;
  #table: DataTable | undefined;
  #padded = new Map<number, number>();
  #encoding: TextEncodingName | undefined;
  #changedOnDisk = false;

  /** The table as the user sees it (after zero padding), for other main-process code. */
  get table(): DataTable | undefined {
    return this.#table;
  }

  async open(path: string): Promise<DataResult> {
    if (!isAbsolute(path)) return fail("read-failed");
    const read = await this.#read(path);
    if (!read.ok) return read.result;
    return this.#build(read.source, undefined, undefined);
  }

  async setEncoding(encoding: TextEncodingName): Promise<DataResult> {
    const source = this.#source;
    if (!source || this.#table?.encoding === undefined) return fail("no-file");
    return this.#build(source, this.#table.sheet, encoding, true);
  }

  async setSheet(sheet: string): Promise<DataResult> {
    const source = this.#source;
    if (!source || this.#table?.sheet === undefined) return fail("no-file");
    return this.#build(source, sheet, undefined, true);
  }

  /** Pad one column. Only a column the scan flags as a numeric ID is accepted. */
  pad(columnIndex: number, width: number): DataResult {
    const table = this.#table;
    if (!this.#source || !table) return fail("no-file");
    const name = table.columns[columnIndex];
    const flagged = scanTable(table).warnings.some(
      (w) => w.kind === "id-stored-as-number" && w.column === name,
    );
    if (!flagged) return fail("bad-column");
    this.#table = padColumn(table, columnIndex, width);
    this.#padded.set(columnIndex, width);
    return this.#ok();
  }

  /** Re-read the file from disk, keeping the sheet and encoding choice where they still apply. */
  async reload(): Promise<DataResult> {
    const old = this.#source;
    if (!old) return fail("no-file");
    const read = await this.#read(old.path);
    if (!read.ok) return read.result;
    return this.#build(read.source, this.#table?.sheet, undefined, true, true);
  }

  clear(): void {
    this.#source = undefined;
    this.#table = undefined;
    this.#padded.clear();
    this.#encoding = undefined;
    this.#changedOnDisk = false;
  }

  /** The current snapshot, or null. Also checks whether the file changed on disk. */
  async current(): Promise<DataSnapshot | null> {
    const source = this.#source;
    if (!source || !this.#table) return null;
    try {
      const info = await stat(source.path);
      this.#changedOnDisk = info.size !== source.size || info.mtimeMs !== source.mtimeMs;
    } catch {
      this.#changedOnDisk = true;
    }
    return this.#snapshot();
  }

  async #read(path: string): Promise<Read> {
    try {
      const info = await stat(path);
      if (!info.isFile()) return { ok: false, result: fail("not-a-spreadsheet") };
      if (info.size > MAX_FILE_BYTES)
        return { ok: false, result: fail("too-large", new DataError("too-large")) };
      const bytes = new Uint8Array(await readFile(path));
      return {
        ok: true,
        source: { path, bytes, size: info.size, mtimeMs: info.mtimeMs, sheets: [] },
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return { ok: false, result: fail(code === "ENOENT" ? "file-missing" : "read-failed") };
    }
  }

  /**
   * Parse `source` and, only when that works, make it the current table. `encoding` is remembered for
   * later reloads; with `keepChoices` (sheet change, encoding change, reload) the earlier encoding is kept.
   */
  async #build(
    source: Source,
    sheet: string | undefined,
    encoding: TextEncodingName | undefined,
    keepChoices = false,
    fallbackToFirst = false,
  ): Promise<DataResult> {
    const chosenEncoding = encoding ?? (keepChoices ? this.#encoding : undefined);
    try {
      const sheets = await sheetNames(source);
      // A sheet that no longer exists after a reload falls back to the first one.
      const wanted =
        sheet !== undefined && fallbackToFirst && !sheets.includes(sheet) ? undefined : sheet;
      const table = await loadTable(basename(source.path), source.bytes, {
        sheet: wanted,
        encoding: chosenEncoding,
      });
      this.#source = { ...source, sheets };
      this.#table = table;
      this.#encoding = chosenEncoding;
      this.#padded.clear();
      this.#changedOnDisk = false;
      return this.#ok();
    } catch (error) {
      return fail(error instanceof DataError ? error.code : "read-failed", error);
    }
  }

  #ok(): DataResult {
    return { ok: true, snapshot: this.#snapshot() };
  }

  #snapshot(): DataSnapshot {
    const table = this.#table as DataTable;
    const source = this.#source as Source;
    const warnings: SnapshotWarning[] = [];
    for (const warning of scanTable(table).warnings) {
      const columnIndex = table.columns.indexOf(warning.column);
      // A padded ID column is handled: the warning would otherwise stay, since its cells are still digits.
      if (warning.kind === "id-stored-as-number" && this.#padded.has(columnIndex)) continue;
      warnings.push(
        warning.kind === "id-stored-as-number"
          ? { ...warning, columnIndex, suggestedWidth: suggestWidth(warning.column, warning.width) }
          : { ...warning, columnIndex },
      );
    }
    return {
      fileName: table.fileName,
      rowCount: table.rows.length,
      columnCount: table.columns.length,
      columns: table.columns,
      previewRows: previewRows(table),
      encoding: table.encoding as TextEncodingName | undefined,
      sheets: source.sheets,
      sheet: table.sheet,
      warnings,
      paddedColumns: [...this.#padded.keys()],
      changedOnDisk: this.#changedOnDisk,
    };
  }
}

/** Sheet names of an `.xlsx`; empty for any other file (the format check happens in `loadTable`). */
async function sheetNames(source: Source): Promise<string[]> {
  const isZip = source.bytes[0] === 0x50 && source.bytes[1] === 0x4b;
  if (!isZip || !/\.xlsx$/i.test(source.path)) return [];
  return listSheets(source.bytes);
}
