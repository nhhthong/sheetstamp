import type {
  FieldMapping,
  LostField,
  MappingField,
  MappingProfile,
  ReconcileResult,
} from "../../shared/ipc/mapping";
import { matchFields } from "./match";
import { normalize } from "./normalize";

export const emptyProfile = (): MappingProfile => ({ version: 1, fields: {} });

/** A saved column name that differs from a current one only by case, diacritics or punctuation still counts. */
function findColumn(saved: string, columns: readonly string[]): string | undefined {
  if (columns.includes(saved)) return saved;
  const n = normalize(saved);
  return n === "" ? undefined : columns.find((c) => normalize(c) === n);
}

/**
 * Recompute a profile after the data's columns changed. Fixed texts and "empty" are kept, a column choice is
 * kept when the column still exists, and a field with no choice (or whose column is gone) is matched again
 * automatically. Fields that lost their column are listed so the user can be told. Fields no longer in the
 * template are dropped. The input profile is not changed.
 */
export function reconcile(
  profile: MappingProfile | null,
  fields: readonly MappingField[],
  columns: readonly string[],
): ReconcileResult {
  const kept: Record<string, FieldMapping> = {};
  const lostPrevious = new Map<string, string>();
  const open: MappingField[] = [];

  for (const field of fields) {
    const choice =
      profile && Object.hasOwn(profile.fields, field.key) ? profile.fields[field.key] : undefined;
    if (!choice) {
      open.push(field);
    } else if (choice.kind !== "column") {
      kept[field.key] = choice;
    } else {
      const column = findColumn(choice.column, columns);
      if (column === undefined) {
        lostPrevious.set(field.key, choice.column);
        open.push(field);
      } else {
        kept[field.key] = { kind: "column", column };
      }
    }
  }

  // Columns the user already chose are not offered again to the automatic matching.
  const taken = new Set(
    Object.values(kept).flatMap((m) => (m.kind === "column" ? [m.column] : [])),
  );
  const free = columns.filter((c) => !taken.has(c));
  const filled: ReconcileResult["filled"] = [];
  for (const m of matchFields(open, free)) {
    if (m.column === null) continue;
    kept[m.field] = { kind: "column", column: m.column };
    filled.push(m);
  }

  const lost: LostField[] = [...lostPrevious].map(([field, previous]) => {
    const now = kept[field];
    return { field, previous, replacedBy: now?.kind === "column" ? now.column : null };
  });
  const unmatched = fields.filter((f) => !Object.hasOwn(kept, f.key)).map((f) => f.key);
  return { profile: { version: 1, fields: kept }, lost, filled, unmatched };
}
