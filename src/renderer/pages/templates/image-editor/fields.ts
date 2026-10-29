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
 * Seam for T-30/T-32 (preview): the text a box shows on the canvas. Until the preview owns the mapping between
 * data columns and fields, this is the field's label, which is what the criterion asks for when no data row
 * applies. A later ticket returns the first data row's value here when data is loaded.
 */
export function sampleText(field: string, labels: Readonly<Record<string, string>>): string {
  return labels[field] ?? field;
}
