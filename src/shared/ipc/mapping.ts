// IPC channels of the "mapping" feature, plus the types the renderer shares with src/main/mapping.
import {
  arrayOf,
  type Channel,
  channel,
  IpcValidationError,
  oneOf,
  record,
  string,
} from "./define";

/** A field of a template: the tag key and the label the user sees (the label is optional). */
export type MappingField = { key: string; label?: string };

export type MatchRule = "exact" | "synonym" | "fuzzy";
export const MATCH_RULES = ["exact", "synonym", "fuzzy"] as const;

/** The column found for one field, or none. `score` is 1 for the best possible match and falls toward the threshold. */
export type FieldMatch =
  | { field: string; column: string; rule: MatchRule; score: number }
  | { field: string; column: null };

/** What one field is filled with. A field with no entry in the profile is unmatched. */
export type FieldMapping =
  | { kind: "column"; column: string }
  | { kind: "fixed"; text: string }
  | { kind: "empty" };

/** The mapping profile saved with a template. Plain JSON, so it can be stored as is. */
export type MappingProfile = { version: 1; fields: Record<string, FieldMapping> };

export type LostField = {
  field: string;
  /** The column the field used before the data changed. */
  previous: string;
  /** A column the automatic matching found instead, or null when the field is now unmatched. */
  replacedBy: string | null;
};

export type ReconcileResult = {
  profile: MappingProfile;
  /** Fields that lost their column (the user must be told). */
  lost: LostField[];
  /** Fields the automatic matching filled this time (fields with no earlier choice, and replacements). */
  filled: Extract<FieldMatch, { column: string }>[];
  /** Fields of the template that still have no entry. */
  unmatched: string[];
};

const MAX_FIELDS = 500;
const MAX_COLUMNS = 2_000;
const MAX_NAME = 500;
const MAX_TEXT = 10_000;

function parseField(value: unknown): MappingField {
  const r = record(value, "field");
  const key = string(r.key, "field key", { min: 1, max: MAX_NAME });
  if (r.label === undefined) return { key };
  return { key, label: string(r.label, "field label", { max: MAX_NAME }) };
}

function parseFields(value: unknown): MappingField[] {
  return arrayOf(value, "fields", parseField, MAX_FIELDS);
}

function parseColumns(value: unknown): string[] {
  return arrayOf(value, "columns", (v) => string(v, "column", { max: MAX_NAME }), MAX_COLUMNS);
}

function parseFieldMapping(value: unknown): FieldMapping {
  const r = record(value, "field mapping");
  const kind = oneOf(r.kind, "kind", ["column", "fixed", "empty"] as const);
  if (kind === "column") return { kind, column: string(r.column, "column", { max: MAX_NAME }) };
  if (kind === "fixed") return { kind, text: string(r.text, "text", { max: MAX_TEXT }) };
  return { kind };
}

export function parseProfile(value: unknown): MappingProfile {
  const r = record(value, "profile");
  if (r.version !== 1) throw new IpcValidationError("profile version must be 1");
  const raw = record(r.fields, "profile fields");
  const keys = Object.keys(raw);
  if (keys.length > MAX_FIELDS) throw new IpcValidationError("profile has too many fields");
  const fields: Record<string, FieldMapping> = Object.create(null) as Record<string, FieldMapping>;
  for (const key of keys) fields[key] = parseFieldMapping(raw[key]);
  return { version: 1, fields: { ...fields } };
}

export type SuggestRequest = { fields: MappingField[]; columns: string[] };
export type ReconcileRequest = SuggestRequest & { profile: MappingProfile | null };

const parseSuggest = (value: unknown): SuggestRequest => {
  const r = record(value);
  return { fields: parseFields(r.fields), columns: parseColumns(r.columns) };
};

/** Ask for the automatic column match of each field. */
export const suggest: Channel<SuggestRequest, FieldMatch[]> = channel(
  "mapping:suggest",
  parseSuggest,
);

/** Keep the still-valid choices of a profile after the data's columns changed. A null profile starts a new one. */
export const reconcile: Channel<ReconcileRequest, ReconcileResult> = channel(
  "mapping:reconcile",
  (value) => {
    const r = record(value);
    return {
      ...parseSuggest(r),
      profile: r.profile === null || r.profile === undefined ? null : parseProfile(r.profile),
    };
  },
);

/** Suggested display label for each tag key (dictionary label, else the key made readable). */
export const labels: Channel<{ keys: string[] }, Record<string, string>> = channel(
  "mapping:labels",
  (value) => ({
    keys: arrayOf(
      record(value).keys,
      "keys",
      (v) => string(v, "key", { min: 1, max: MAX_NAME }),
      MAX_FIELDS,
    ),
  }),
);

export const channels = [suggest, reconcile, labels] as const;
export const events = [] as const;
