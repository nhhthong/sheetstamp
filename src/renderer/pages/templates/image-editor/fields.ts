import { fieldKeyOf } from "../../../../shared/image-layout/field-key";

export type FieldOption = { key: string; label: string };

/**
 * Key and label for a field the user typed. A name that matches a field already in the template reuses that key and
 * label, so one field never has two spellings.
 */
export function newField(
  typed: string,
  known: Readonly<Record<string, string>>,
): FieldOption | null {
  const label = typed.trim().normalize("NFC");
  const key = fieldKeyOf(label);
  if (key === "") return null;
  return { key, label: known[key] ?? label };
}

/** The label a field shows: the stored one, else the key. */
export function labelFor(field: string, labels: Readonly<Record<string, string>>): string {
  return labels[field] ?? field;
}

/**
 * The text a box shows on the canvas and in the preview: the first data row's cell when the field has a column
 * (`sample` comes from main, which applies the mapping rules), else the field's label, else its key.
 */
export function sampleText(
  field: string,
  labels: Readonly<Record<string, string>>,
  sample: Readonly<Record<string, string>> = {},
): string {
  return sample[field] ?? labelFor(field, labels);
}
