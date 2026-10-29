/** Families a new box can start with: they draw Vietnamese diacritics and are installed on most systems. */
const PREFERRED = [
  "Inter",
  "Noto Sans",
  "Roboto",
  "Ubuntu",
  "Open Sans",
  "Segoe UI",
  "Arial",
  "Liberation Sans",
  "DejaVu Sans",
  "Cantarell",
  "Calibri",
  "Carlito",
  "Helvetica",
  "Tahoma",
  "Verdana",
];
const NOT_TEXT = /mono|courier|symbol|dingbat|emoji|icon/i;

/** The family a new box starts with: a known good one, else the first that looks like a text face. */
export function defaultFont(fonts: readonly { family: string }[]): string | null {
  for (const wanted of PREFERRED) {
    const found = fonts.find((f) => f.family === wanted);
    if (found) return found.family;
  }
  return (fonts.find((f) => !NOT_TEXT.test(f.family)) ?? fonts[0])?.family ?? null;
}
