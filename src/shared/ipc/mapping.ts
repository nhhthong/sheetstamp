// IPC channels of the "mapping" feature, plus the types the renderer shares with src/main/mapping.
import {
  arrayOf,
  type Channel,
  channel,
  IpcValidationError,
  integer,
  nothing,
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

/** How well one template fits the loaded data: `matched` of its `total` fields found a column. */
export type TemplateFit = { templateId: string; matched: number; total: number };

export type RankResult = {
  /** False when no data is loaded in main; then every fit is 0 of `total`. */
  hasData: boolean;
  items: TemplateFit[];
};

/** Count, for every Word template, the fields that match a column of the data loaded on the Home page. */
export const rankTemplates: Channel<undefined, RankResult> = channel(
  "mapping:rankTemplates",
  nothing,
);

/** The group chip chosen last time (a group id), or null for "Tất cả". A group that no longer exists reads as null. */
export const getGroupFilter: Channel<undefined, string | null> = channel(
  "mapping:getGroupFilter",
  nothing,
);

export const setGroupFilter: Channel<{ groupId: string | null }, void> = channel(
  "mapping:setGroupFilter",
  (value) => {
    const r = record(value).groupId;
    return { groupId: r === null ? null : string(r, "groupId", { min: 1, max: 200 }) };
  },
);

export type UsedTemplate =
  | { ok: true; name: string; groupName: string }
  | { ok: false; message: string };

/** Mark a Word template as used (sets its last-used date). The id is checked in main. */
export const useTemplate: Channel<{ templateId: string }, UsedTemplate> = channel(
  "mapping:useTemplate",
  (value) => ({ templateId: string(record(value).templateId, "templateId", { min: 1, max: 200 }) }),
);

/** Longest fixed text a user can type for one field. */
export const MAX_FIXED_TEXT = 1000;

export type MappingFieldView = { key: string; label: string };

/** What step 3 needs to draw its list. The table itself never leaves main: only column names and a row count. */
export type MappingView = {
  templateName: string;
  fields: MappingFieldView[];
  columns: string[];
  rowCount: number;
  /** One entry per resolved field. A field with no entry is unresolved. */
  entries: Record<string, FieldMapping>;
  /** Fields with no entry when the step was entered (after automatic matching), in template order. */
  unmatched: string[];
  /** Fields that lost their column because the data changed. */
  lost: LostField[];
};

export type OpenedMapping = { ok: true; view: MappingView } | { ok: false; message: string };

const templateIdOf = (value: unknown) =>
  string(record(value).templateId, "templateId", { min: 1, max: 200 });

/**
 * Enter step 3: load the template and the current data in main, match the fields against the columns, keep the
 * valid choices of the stored profile and save the result back to the template.
 */
export const openMapping: Channel<{ templateId: string }, OpenedMapping> = channel(
  "mapping:open",
  (value) => ({ templateId: templateIdOf(value) }),
);

export type SetEntryRequest = { templateId: string; key: string; entry: FieldMapping | null };
export type SetEntryResult =
  | { ok: true; entries: Record<string, FieldMapping> }
  | { ok: false; message: string };

/** Save one field's choice with the template (null clears it). Column names must exist in the loaded data. */
export const setEntry: Channel<SetEntryRequest, SetEntryResult> = channel(
  "mapping:setEntry",
  (value) => {
    const r = record(value);
    return {
      templateId: templateIdOf(r),
      key: string(r.key, "key", { min: 1, max: MAX_NAME }),
      entry: r.entry === null ? null : parseFieldMapping(r.entry),
    };
  },
);

export type RowResult = { ok: true; cells: string[] } | { ok: false; message: string };

/** The cell text of one data row, aligned with `MappingView.columns`. Only this row leaves main. */
export const getRow: Channel<{ index: number }, RowResult> = channel("mapping:row", (value) => ({
  index: integer(record(value).index, "index", { min: 0, max: 1_000_000 }),
}));

export type TemplateBytes = { ok: true; docx: Uint8Array } | { ok: false; message: string };

/** The stored Word file of a template, for the preview. */
export const getTemplateBytes: Channel<{ templateId: string }, TemplateBytes> = channel(
  "mapping:templateBytes",
  (value) => ({ templateId: templateIdOf(value) }),
);

export const channels = [
  suggest,
  reconcile,
  labels,
  rankTemplates,
  getGroupFilter,
  setGroupFilter,
  useTemplate,
  openMapping,
  setEntry,
  getRow,
  getTemplateBytes,
] as const;
export const events = [] as const;
