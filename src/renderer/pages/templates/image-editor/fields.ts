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
