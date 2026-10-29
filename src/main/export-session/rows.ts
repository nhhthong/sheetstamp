// The row values of a whole table, built with the same function the Step 3 preview uses (`rowValues`).

import type { FieldMapping } from "../../shared/ipc/mapping";
import { rowValues } from "../../shared/mapping/values";
import type { DataTable } from "../data";

export type ExportRow = {
  rowNumber: number;
  values: Record<string, string>;
  /** A value the Word file cannot hold: the row is reported as `invalid-value` and never made. */
  invalid?: true;
};

// Characters XML 1.0 cannot hold: controls other than tab, line feed and carriage return, lone surrogates, U+FFFE and
// U+FFFF. The Word engine writes them as they are, which makes Word call the file corrupt.
export function hasUnwritableCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x20) {
      if (unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) return true;
    } else if (unit === 0xfffe || unit === 0xffff) {
      return true;
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * One entry per data row, `rowNumber` counting from 1 (the same number as the "Dòng 3/12" pager and the error report).
 *  - a mapped cell that is empty gives "" and the row is exported;
 *  - a tag with no value (no mapping, or a column that is not in the data) is left out of `values`, so the worker
 *    fails that row with `missing-tag`;
 *  - a cell the Word file cannot hold marks the row `invalid`, reported as `invalid-value` (another cause, another fix);
 *    an image has no such limit, so `checkXml` is false for image templates.
 */
export function buildRows(
  table: DataTable,
  keys: readonly string[],
  entries: Readonly<Record<string, FieldMapping>>,
  checkXml = true,
): ExportRow[] {
  return table.rows.map((cells, index) => {
    const { values } = rowValues(keys, entries, table.columns, cells);
    const row: ExportRow = { rowNumber: index + 1, values };
    if (checkXml && Object.values(values).some(hasUnwritableCharacter)) row.invalid = true;
    return row;
  });
}
