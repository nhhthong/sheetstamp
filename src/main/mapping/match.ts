import Fuse from "fuse.js";
import type { FieldMatch, MappingField, MatchRule } from "../../shared/ipc/mapping";
import { editDistance, normalize, sortedTokens, tokenCount } from "./normalize";

export type MatchOptions = {
  /** Fuse score limit: 0 is a perfect match, so lower means stricter. */
  threshold?: number;
  /** A best fuzzy match is dropped when the runner-up column scores within this distance of it. */
  ambiguityMargin?: number;
  /** Confirm every Fuse hit word by word (default true). Only the threshold study turns it off. */
  confirmWords?: boolean;
};

/**
 * Settled on the fixtures (tests/fixtures/mapping, src/main/mapping/threshold.test.ts):
 * 0.25 maps every typo and word-order variant of the fixtures and no near miss.
 */
export const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_MARGIN = 0.05;
/** Shorter names are abbreviations ("sdt", "mnv"); a one-letter slip would turn one into another. */
const MIN_FUZZY_LENGTH = 5;
/** Compact forms (spaces removed) must have nearly the same length, so "ho" never fuzzy-matches "hoten". */
const MIN_LENGTH_RATIO = 0.85;
const RANK: Record<MatchRule, number> = { exact: 0, fuzzy: 1, position: 2 };

/**
 * Fuse scores a pattern against a text loosely (a pattern found inside a longer text, or with a few
 * different words, still scores well). So every Fuse hit is confirmed word by word: each word may differ
 * by one letter (two for long words), so "Số hợp đồng" never becomes "Loại hợp đồng".
 */
function wordsClose(a: string, b: string): boolean {
  const x = a.split(" ");
  const y = b.split(" ");
  if (x.length !== y.length) return false;
  return x.every((word, i) => {
    const other = y[i] as string;
    const longest = Math.max(word.length, other.length);
    const allowed = longest <= 3 ? 0 : longest <= 6 ? 1 : 2;
    return editDistance(word, other) <= allowed;
  });
}

type Candidate = {
  fieldIndex: number;
  columnIndex: number;
  rule: MatchRule;
  /** 1 is best. */
  score: number;
};

type Form = { columnIndex: number; text: string };

/** The names a column may carry to match a field exactly: the tag and its label. */
function fieldNames(field: MappingField): Set<string> {
  const names = new Set([normalize(field.key)]);
  if (field.label) names.add(normalize(field.label));
  names.delete("");
  return names;
}

/**
 * Find a column for each field. Rules, in order: exact (after removing diacritics, against the tag and its
 * label), then fuzzy. A column is given to one field only, and a field with no confident column
 * stays unmatched (`column: null`).
 */
export function matchFields(
  fields: readonly MappingField[],
  columns: readonly string[],
  options: MatchOptions = {},
): FieldMatch[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const margin = options.ambiguityMargin ?? DEFAULT_MARGIN;
  const confirmWords = options.confirmWords ?? true;
  const normColumns = columns.map(normalize);

  const spaced: Form[] = [];
  const compact: Form[] = [];
  normColumns.forEach((n, columnIndex) => {
    if (n === "") return;
    spaced.push({ columnIndex, text: sortedTokens(n) });
    compact.push({ columnIndex, text: n.replace(/ /g, "") });
  });
  const fuseOptions = {
    keys: ["text"],
    includeScore: true,
    threshold,
    ignoreLocation: true,
    isCaseSensitive: true,
    ignoreFieldNorm: true,
  };
  const spacedFuse = new Fuse(spaced, fuseOptions);
  const compactFuse = new Fuse(compact, fuseOptions);

  const candidates: Candidate[] = [];
  fields.forEach((field, fieldIndex) => {
    const names = fieldNames(field);
    normColumns.forEach((n, columnIndex) => {
      if (n === "") return;
      if (names.has(n)) candidates.push({ fieldIndex, columnIndex, rule: "exact", score: 1 });
    });

    // Fuzzy: best Fuse distance per column over the field's names.
    const best = new Map<number, number>();
    for (const name of names) {
      const compactName = name.replace(/ /g, "");
      if (compactName.length < MIN_FUZZY_LENGTH) continue;
      const sorted = sortedTokens(name);
      const tokens = tokenCount(name);
      for (const hit of spacedFuse.search(sorted)) {
        if (tokenCount(hit.item.text) !== tokens) continue;
        if (confirmWords && !wordsClose(sorted, hit.item.text)) continue;
        const d = hit.score ?? 1;
        if (d < (best.get(hit.item.columnIndex) ?? 1)) best.set(hit.item.columnIndex, d);
      }
      for (const hit of compactFuse.search(compactName)) {
        const a = hit.item.text.length;
        if (Math.min(a, compactName.length) / Math.max(a, compactName.length) < MIN_LENGTH_RATIO)
          continue;
        if (confirmWords && editDistance(compactName, hit.item.text) > 2) continue;
        const d = hit.score ?? 1;
        if (d < (best.get(hit.item.columnIndex) ?? 1)) best.set(hit.item.columnIndex, d);
      }
    }
    const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
    const top = ranked[0];
    if (!top || top[1] > threshold) return;
    const runnerUp = ranked[1];
    if (runnerUp && runnerUp[1] - top[1] < margin) return;
    candidates.push({ fieldIndex, columnIndex: top[0], rule: "fuzzy", score: 1 - top[1] });
  });

  candidates.sort(
    (a, b) =>
      RANK[a.rule] - RANK[b.rule] ||
      b.score - a.score ||
      a.fieldIndex - b.fieldIndex ||
      a.columnIndex - b.columnIndex,
  );

  const byField = new Map<number, Candidate>();
  const usedColumns = new Set<number>();
  for (const c of candidates) {
    if (byField.has(c.fieldIndex) || usedColumns.has(c.columnIndex)) continue;
    byField.set(c.fieldIndex, c);
    usedColumns.add(c.columnIndex);
  }

  return fields.map((field, fieldIndex): FieldMatch => {
    const c = byField.get(fieldIndex);
    const column = c ? columns[c.columnIndex] : undefined;
    if (!c || column === undefined) return { field: field.key, column: null };
    return { field: field.key, column, rule: c.rule, score: c.score };
  });
}
