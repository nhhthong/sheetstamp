/** Why a row failed. Codes only: the report never contains source data. */
export type RowErrorCode =
  | "missing-tag"
  | "invalid-value"
  | "font-missing"
  | "text-too-long"
  | "bad-background"
  | "render-failed"
  | "invalid-name"
  | "unknown";

export type RowError = { row: number; code: RowErrorCode };

/** A cell that starts with these is read as a formula by spreadsheet programs. */
const FORMULA_START = /^[=+\-@]/;

const cell = (value: string) => (FORMULA_START.test(value) ? `\t${value}` : value);

export function errorReportCsv(errors: readonly RowError[]): string {
  const lines = ["row,error_code", ...errors.map((e) => `${cell(String(e.row))},${cell(e.code)}`)];
  return `${lines.join("\r\n")}\r\n`;
}
