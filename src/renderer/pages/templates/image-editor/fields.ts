import dictionary from "../../../../../data/hr-dictionary.json";
import { fieldKeyOf } from "../../../../shared/image-layout/field-key";

export type FieldOption = { key: string; label: string };

/** The HR dictionary as the dropdown's first part: compiled into the bundle, never read at run time. */
export const dictionaryFields: readonly FieldOption[] = dictionary.entries.map(
  ({ key, label }) => ({ key, label }),
);

/**
 * Key and label for a field the user typed. A label that names a dictionary entry or an already known field
 * reuses that key and label, so one field never has two spellings.
 */
export function newField(
  typed: string,
  known: Readonly<Record<string, string>>,
): FieldOption | null {
  const label = typed.trim().normalize("NFC");
  const key = fieldKeyOf(label);
  if (key === "") return null;
  const label0 = known[key] ?? dictionaryFields.find((f) => f.key === key)?.label;
  return { key, label: label0 ?? label };
}

/**
 * The label a field shows: the stored one, else the dictionary's, else the key. A stored label equal to the key
 * is what an earlier version saved for a field picked from the list, so it counts as missing.
 */
export function labelFor(field: string, labels: Readonly<Record<string, string>>): string {
  const stored = labels[field];
  if (stored !== undefined && stored !== field) return stored;
  return dictionaryFields.find((f) => f.key === field)?.label ?? stored ?? field;
}

/**
 * The text a box shows on the canvas and in the preview: the first data row's cell when a column matches the
 * field (`sample` comes from main, which applies the mapping rules), else the field's label, else its key.
 */
export function sampleText(
  field: string,
  labels: Readonly<Record<string, string>>,
  sample: Readonly<Record<string, string>> = {},
): string {
  return sample[field] ?? labelFor(field, labels);
}
