import { stripDiacritics } from "../text/diacritics";

/**
 * The field key of a label typed by the user: no diacritics (đ becomes d), lowercase, runs of anything but
 * letters and digits become one underscore, none at the ends. Same shape as the dictionary keys (`ho_ten`).
 * Empty when the label has no letter or digit.
 */
export function fieldKeyOf(label: string): string {
  return stripDiacritics(label.normalize("NFC"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
