import type { TemplateFit } from "../../shared/ipc/mapping";
import { matchFields } from "./match";

type Rankable = { id: string; tags: readonly { name: string; label: string }[] };

/**
 * For each template, how many of its fields find a column among `columns` (the Phase 0 matching of
 * `matchFields`, with the template's labels). `total` counts fields only: unsupported tags (loops, footnotes)
 * are not stored with the template, so a template with none but unsupported tags has total 0 and matched 0.
 */
export function rankTemplates(
  templates: readonly Rankable[],
  columns: readonly string[],
): TemplateFit[] {
  return templates.map((t) => {
    const total = t.tags.length;
    if (total === 0 || columns.length === 0) return { templateId: t.id, matched: 0, total };
    const matches = matchFields(
      t.tags.map((tag) => ({ key: tag.name, label: tag.label })),
      columns,
    );
    return { templateId: t.id, matched: matches.filter((m) => m.column !== null).length, total };
  });
}
