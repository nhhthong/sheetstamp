// The row values of a whole table, built with the same function the Step 3 preview uses (`rowValues`).
import { rowValues } from "../../renderer/pages/home/mapping-values";
import type { FieldMapping } from "../../shared/ipc/mapping";
import type { DataTable } from "../data";

export type ExportRow = { rowNumber: number; values: Record<string, string> };

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
 *  - a tag with no usable value (no mapping, a column that is not in the data, or a cell the Word file cannot hold)
 *    is left out of `values`, so the worker fails that row with `missing-tag` and it is reported, not exported.
 */
export function buildRows(
  table: DataTable,
  keys: readonly string[],
  entries: Readonly<Record<string, FieldMapping>>,
): ExportRow[] {
  return table.rows.map((cells, index) => {
    const { values } = rowValues(keys, entries, table.columns, cells);
    for (const [key, value] of Object.entries(values)) {
      if (hasUnwritableCharacter(value)) delete values[key];
    }
    return { rowNumber: index + 1, values };
  });
}
