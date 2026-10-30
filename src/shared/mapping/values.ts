import type { FieldMapping } from "../ipc/mapping";

export type Entries = Readonly<Record<string, FieldMapping>>;

/**
 * Whether a field is settled. No entry is not; a column is; "Để trống" is; fixed text is once something was
 * typed (the box was opened but is still empty, so the user has not decided yet).
 */
export function isResolved(entry: FieldMapping | undefined): boolean {
  if (!entry) return false;
  return entry.kind !== "fixed" || entry.text !== "";
}

export const countUnresolved = (keys: readonly string[], entries: Entries): number =>
  keys.filter((key) => !isResolved(entries[key])).length;

/**
 * The columns that the unresolved fields would take if matched in order: the first unresolved field takes the first
 * column that no field uses, and so on. Fields left over, when there are fewer free columns, get nothing.
 */
export function fillInOrder(
  keys: readonly string[],
  entries: Entries,
  columns: readonly string[],
): [key: string, column: string][] {
  const used = new Set(
    Object.values(entries).flatMap((e) => (e.kind === "column" ? [e.column] : [])),
  );
  const free = columns.filter((c) => c.trim() !== "" && !used.has(c));
  return keys
    .filter((key) => !isResolved(entries[key]))
    .slice(0, free.length)
    .map((key, i): [string, string] => [key, free[i] as string]);
}

/**
 * The values of one row for the preview, keyed by tag key.
 *  - column: the cell text, which may be "" (shown as an empty value, red);
 *  - fixed text: what the user typed;
 *  - "Để trống": "";
 *  - no entry, an unfinished fixed text, or a column that is not in the data: unmapped (shown as missing).
 * Fixed text is never looked up as a column name, and a cell value is never read as a column name.
 */
export function rowValues(
  keys: readonly string[],
  entries: Entries,
  columns: readonly string[],
  cells: readonly string[],
): { values: Record<string, string>; unmapped: string[] } {
  const values: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const key of keys) {
    const entry = entries[key];
    if (!isResolved(entry) || !entry) {
      unmapped.push(key);
    } else if (entry.kind === "fixed") {
      values[key] = entry.text;
    } else if (entry.kind === "empty") {
      values[key] = "";
    } else {
      const index = columns.indexOf(entry.column);
      if (index < 0) unmapped.push(key);
      else values[key] = cells[index] ?? "";
    }
  }
  return { values, unmapped };
}
