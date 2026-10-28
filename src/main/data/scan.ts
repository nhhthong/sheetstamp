import { stripDiacritics } from "../../shared/text/diacritics";
import type { DataTable } from "./table";

export type ColumnScan = {
  column: string;
  emptyCells: number;
  /** Cells that are numbers and cells that are text, both non-empty. */
  numberCells: number;
  textCells: number;
};

export type DataWarning =
  | { kind: "empty-cells"; column: string; count: number }
  | { kind: "mixed-types"; column: string }
  | { kind: "id-stored-as-number"; column: string; width: number };

const strip = (text: string) => stripDiacritics(text).toLowerCase();

/** Header words that usually name an identifier whose leading zeros matter. */
const ID_HEADER = /(cccd|cmnd|can cuoc|dien thoai|sdt|phone|ma so thue|\bmst\b|bhxh|so tai khoan|\bstk\b|ma nv|ma nhan vien)/;

const isNumberText = (text: string) => /^\d+$/.test(text);

export function scanTable(table: DataTable): { columns: ColumnScan[]; warnings: DataWarning[] } {
  const columns: ColumnScan[] = [];
  const warnings: DataWarning[] = [];
  table.columns.forEach((column, i) => {
    const cells = table.rows.map((row) => row[i] ?? "");
    const filled = cells.filter((cell) => cell.trim() !== "");
    const numberCells = filled.filter((cell) => /^-?[\d.,\s]+$/.test(cell) && /\d/.test(cell)).length;
    const scan: ColumnScan = {
      column,
      emptyCells: cells.length - filled.length,
      numberCells,
      textCells: filled.length - numberCells,
    };
    columns.push(scan);
    if (scan.emptyCells > 0) warnings.push({ kind: "empty-cells", column, count: scan.emptyCells });
    if (scan.numberCells > 0 && scan.textCells > 0) warnings.push({ kind: "mixed-types", column });
    // A numeric spreadsheet cell under an ID-like header has already lost any leading zeros.
    if (table.numericColumns[i] && ID_HEADER.test(strip(column)) && filled.every(isNumberText)) {
      warnings.push({
        kind: "id-stored-as-number",
        column,
        width: Math.max(...filled.map((cell) => cell.length)),
      });
    }
  });
  return { columns, warnings };
}

/** Pad every non-empty cell of a column with leading zeros to `width` characters. */
export function padColumn(table: DataTable, columnIndex: number, width: number): DataTable {
  const rows = table.rows.map((row) =>
    row.map((cell, i) => (i === columnIndex && cell !== "" ? cell.padStart(width, "0") : cell)),
  );
  return { ...table, rows };
}
