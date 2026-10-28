import type { TemplateSummary } from "../../../shared/ipc/templates";
import { stripDiacritics } from "../../../shared/text/diacritics";

/**
 * Lowercase text without diacritics. Decomposes (NFD) and drops combining marks, so "Hợp" is "hop" whether it
 * was typed precomposed or with combining marks; đ and Đ become d (they are letters, not marks, so NFD keeps them).
 */
export function fold(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

export type RankedTemplate = TemplateSummary & { matched: number; total: number };

/** A template matches when every word of the query is found in its name, group or note. An empty query matches all. */
export function matchesQuery(template: TemplateSummary, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(`${template.name} ${template.groupName} ${template.note}`);
  return words.every((word) => haystack.includes(word));
}

/** Best column match first, then most recently used (never used last), then name. */
export function compareTemplates(a: RankedTemplate, b: RankedTemplate): number {
  if (a.matched !== b.matched) return b.matched - a.matched;
  if (a.lastUsedAt !== b.lastUsedAt) {
    if (a.lastUsedAt === null) return 1;
    if (b.lastUsedAt === null) return -1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  }
  return a.name.localeCompare(b.name, "vi");
}

export function visibleTemplates(
  all: readonly RankedTemplate[],
  query: string,
  groupId: string | null,
): RankedTemplate[] {
  return all
    .filter((t) => (groupId === null || t.groupId === groupId) && matchesQuery(t, query))
    .sort(compareTemplates);
}
