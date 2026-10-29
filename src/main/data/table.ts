import { t } from "../../shared/i18n";
import { DataError, MAX_ROWS } from "./errors";

/** Imported data. Never written to disk (spec section 5, Input data). */
export type DataTable = {
  fileName: string;
  /** Sheet name for `.xlsx`; undefined for CSV. */
  sheet?: string;
  encoding?: string;
  columns: string[];
  /** Cell text, NFC. Rows are as long as `columns`. */
  rows: string[][];
  /** For each column: whether every non-empty cell came from a numeric spreadsheet cell. */
  numericColumns: boolean[];
};

const clean = (cell: string) => cell.normalize("NFC");

/** Header names: trimmed, blanks get "Cột n", repeats get " (2)", " (3)". */
export function headerNames(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, i) => {
    const base = clean(cell).trim() || `${t("Cột", "Column")} ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/** First row is the header; short rows are padded; fully empty rows are dropped. */
export function buildTable(
  meta: Pick<DataTable, "fileName" | "sheet" | "encoding">,
  grid: string[][],
  numeric?: boolean[][],
): DataTable {
  const nonEmpty = grid
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => cell.trim() !== ""));
  const header = nonEmpty[0];
  if (!header) throw new DataError("empty");
  const width = Math.max(...nonEmpty.map(({ row }) => row.length));
  const columns = headerNames(Array.from({ length: width }, (_, i) => header.row[i] ?? ""));
  const body = nonEmpty.slice(1);
  if (body.length === 0) throw new DataError("empty");
  if (body.length > MAX_ROWS) throw new DataError("too-many-rows");
  const rows = body.map(({ row }) => columns.map((_, i) => clean(row[i] ?? "")));
  const numericColumns = columns.map((_, i) => {
    const cells = body.filter(({ row }) => (row[i] ?? "").trim() !== "");
    return cells.length > 0 && cells.every(({ index }) => numeric?.[index]?.[i] === true);
  });
  return { ...meta, columns, rows, numericColumns };
}
