import ExcelJS from "exceljs";
import SSF from "ssf";
import { DataError } from "./errors";
import { buildTable, type DataTable } from "./table";

type CellValue = ExcelJS.CellValue;

/** Excel serial date for a JS Date (1900 date system, UTC). */
export const toSerial = (date: Date): number =>
  (date.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;

function format(value: number, numFmt: string | undefined): string {
  try {
    return SSF.format(numFmt && numFmt !== "General" ? numFmt : "General", value);
  } catch {
    return String(value);
  }
}

/**
 * Text as Excel shows it. exceljs `cell.text` ignores number formats (prototype spike3),
 * so numbers and dates go through SSF with the cell's own format.
 */
export function cellText(value: CellValue, numFmt: string | undefined): { text: string; numeric: boolean } {
  if (value === null || value === undefined) return { text: "", numeric: false };
  if (typeof value === "number") return { text: format(value, numFmt), numeric: true };
  if (value instanceof Date) {
    return { text: format(toSerial(value), numFmt ?? "yyyy-mm-dd"), numeric: false };
  }
  if (typeof value === "boolean") return { text: value ? "TRUE" : "FALSE", numeric: false };
  if (typeof value === "string") return { text: value, numeric: false };
  if ("richText" in value) return { text: value.richText.map((part) => part.text).join(""), numeric: false };
  if ("formula" in value || "sharedFormula" in value) {
    const result = (value as { result?: CellValue }).result;
    return result === undefined ? { text: "", numeric: false } : cellText(result, numFmt);
  }
  if ("hyperlink" in value) return { text: String(value.text ?? ""), numeric: false };
  if ("error" in value) return { text: "", numeric: false };
  return { text: "", numeric: false };
}

async function load(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  } catch {
    throw new DataError("unreadable");
  }
  return workbook;
}

export async function listSheets(bytes: Uint8Array): Promise<string[]> {
  return (await load(bytes)).worksheets.map((sheet) => sheet.name);
}

export async function readXlsx(fileName: string, bytes: Uint8Array, sheet?: string): Promise<DataTable> {
  const workbook = await load(bytes);
  const worksheet = sheet ? workbook.getWorksheet(sheet) : workbook.worksheets[0];
  if (!worksheet) throw new DataError(sheet ? "no-such-sheet" : "empty");
  const grid: string[][] = [];
  const numeric: boolean[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const texts: string[] = [];
    const flags: boolean[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const { text, numeric: isNumber } = cellText(cell.value, cell.numFmt);
      texts[col - 1] = text;
      flags[col - 1] = isNumber;
    });
    // exceljs rows are 1-based and may skip numbers; keep positions so header and body line up.
    grid[rowNumber - 1] = Array.from(texts, (t) => t ?? "");
    numeric[rowNumber - 1] = Array.from(flags, (f) => f === true);
  });
  const dense = Array.from(grid, (row) => row ?? []);
  return buildTable({ fileName, sheet: worksheet.name }, dense, numeric);
}
