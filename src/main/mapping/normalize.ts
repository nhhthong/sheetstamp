import { stripDiacritics } from "../../shared/text/diacritics";

/** Lowercase, remove diacritics (đ -> d), turn `_`, `-`, punctuation into single spaces. */
export function normalize(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words sorted, so that word order does not matter ("ten ho" equals "ho ten"). */
export function sortedTokens(normalized: string): string {
  return normalized.split(" ").filter(Boolean).sort().join(" ");
}

export function tokenCount(normalized: string): number {
  return normalized === "" ? 0 : normalized.split(" ").length;
}

/** Edit distance where a swap of two neighbouring letters counts once (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  const first = rows[0] as number[];
  for (let j = 1; j <= b.length; j++) first[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const row = rows[i] as number[];
    const prev = rows[i - 1] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, ((rows[i - 2] as number[])[j - 2] as number) + 1);
      }
      row[j] = d;
    }
  }
  return (rows[a.length] as number[])[b.length] as number;
}
