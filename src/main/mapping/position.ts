import type { FieldMatch, MappingField } from "../../shared/ipc/mapping";

/**
 * Image templates: the n-th field takes the n-th column, left to right. A field without a column there (the file has
 * fewer columns, or the column has no name) stays unmatched.
 */
export function matchByPosition(
  fields: readonly MappingField[],
  columns: readonly string[],
): FieldMatch[] {
  return fields.map((field, index): FieldMatch => {
    const column = columns[index];
    if (column === undefined || column.trim() === "") return { field: field.key, column: null };
    return { field: field.key, column, rule: "position", score: 1 };
  });
}
