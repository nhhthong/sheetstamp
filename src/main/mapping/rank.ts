import type { TemplateFit } from "../../shared/ipc/mapping";
import { matchFields } from "./match";
import { matchByPosition } from "./position";

type Rankable = {
  id: string;
  kind?: "word" | "image";
  tags: readonly { name: string; label: string }[];
};

/**
 * For each template, how many of its fields find a column among `columns` (`matchFields` with the template's
 * labels; `matchByPosition` for an image template). `total` counts fields only: unsupported tags (loops, footnotes)
 * are not stored with the template, so a template with none but unsupported tags has total 0 and matched 0.
 */
export function rankTemplates(
  templates: readonly Rankable[],
  columns: readonly string[],
): TemplateFit[] {
  return templates.map((t) => {
    const total = t.tags.length;
    if (total === 0 || columns.length === 0) return { templateId: t.id, matched: 0, total };
    const fields = t.tags.map((tag) => ({ key: tag.name, label: tag.label }));
    const matches =
      t.kind === "image" ? matchByPosition(fields, columns) : matchFields(fields, columns);
    return { templateId: t.id, matched: matches.filter((m) => m.column !== null).length, total };
  });
}
