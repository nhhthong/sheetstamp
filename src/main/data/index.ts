import { DataError, MAX_FILE_BYTES } from "./errors";
import { detectFormat } from "./format";
import { readCsv } from "./csv";
import type { TextEncodingName } from "./encoding";
import { readXlsx } from "./xlsx";
import type { DataTable } from "./table";

export { DataError, MAX_FILE_BYTES, MAX_ROWS } from "./errors";
export { listSheets } from "./xlsx";
export { padColumn, scanTable } from "./scan";
export type { DataTable } from "./table";
export type { TextEncodingName } from "./encoding";
export { SELECTABLE_ENCODINGS } from "./encoding";

export type LoadOptions = { sheet?: string; encoding?: TextEncodingName };

export const PREVIEW_ROWS = 5;

/** Read one CSV or Excel file into a table. Pure: the caller reads the bytes and discards them. */
export async function loadTable(
  fileName: string,
  bytes: Uint8Array,
  options: LoadOptions = {},
): Promise<DataTable> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new DataError("too-large");
  const format = detectFormat(fileName, bytes);
  return format === "xlsx"
    ? readXlsx(fileName, bytes, options.sheet)
    : readCsv(fileName, bytes, options.encoding);
}

export const previewRows = (table: DataTable) => table.rows.slice(0, PREVIEW_ROWS);
