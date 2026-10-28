// The filename pattern as the chips show it. The stored pattern is one string with `{{key}}` tags; the chips are a
// view of it. Names themselves are never built here: main does that (see src/main/export/filename.ts).
export type Chip = { type: "field"; key: string } | { type: "text"; value: string };

const TAG = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** The same split main uses: fixed text and `{{key}}` tags, in order. */
export function chipsOf(pattern: string): Chip[] {
  const chips: Chip[] = [];
  let last = 0;
  for (const match of pattern.matchAll(TAG)) {
    if (match.index > last) chips.push({ type: "text", value: pattern.slice(last, match.index) });
    chips.push({ type: "field", key: (match[1] as string).normalize("NFC") });
    last = match.index + match[0].length;
  }
  if (last < pattern.length) chips.push({ type: "text", value: pattern.slice(last) });
  return chips;
}

export const patternOf = (chips: readonly Chip[]): string =>
  chips.map((chip) => (chip.type === "field" ? `{{${chip.key}}}` : chip.value)).join("");
