// Boundary between the stored mapping (flat `Record<tag, entry>`, see src/main/storage/types.ts) and the
// `{ version: 1, fields }` wrapper that src/main/mapping works with. Only the flat record is persisted.
import type { FieldMapping, MappingProfile } from "../../shared/ipc/mapping";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isEntry(v: unknown): v is FieldMapping {
  if (!isObject(v)) return false;
  if (v.kind === "column") return typeof v.column === "string";
  if (v.kind === "fixed") return typeof v.text === "string";
  return v.kind === "empty";
}

/**
 * The wrapper for a stored mapping. Accepts the flat record (what storage holds) and, to be lenient with
 * older writes, a wrapper that already has `version` and `fields`. Anything that is not a valid entry is dropped.
 */
export function toProfile(stored: unknown): MappingProfile {
  const source =
    isObject(stored) && stored.version === 1 && isObject(stored.fields) ? stored.fields : stored;
  const fields: Record<string, FieldMapping> = {};
  if (isObject(source)) {
    for (const [tag, entry] of Object.entries(source)) if (isEntry(entry)) fields[tag] = entry;
  }
  return { version: 1, fields };
}

/** The flat record to persist. The result is a copy. */
export function toRecord(profile: MappingProfile): Record<string, FieldMapping> {
  return { ...profile.fields };
}
