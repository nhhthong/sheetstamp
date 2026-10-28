import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getRow } from "../../../shared/ipc/mapping";
import { type Entries, rowValues } from "../../../shared/mapping/values";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { WordPreview } from "../../preview/WordPreview";
import { homeMapping as t } from "../../strings/home-mapping";

export type MappingPreviewProps = {
  template: Uint8Array;
  keys: readonly string[];
  entries: Entries;
  columns: readonly string[];
  rowCount: number;
};

/**
 * Sticky preview with a pager. Only one row is fetched at a time (there is no list of rows, so 50,000 rows
 * cost the same as 2). The values come from that row through the mapping, so a change of mapping redraws
 * with the row already in hand.
 */
export function MappingPreview({
  template,
  keys,
  entries,
  columns,
  rowCount,
}: MappingPreviewProps) {
  const [index, setIndex] = useState(0);
  const [cells, setCells] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setFailed(false);
    call(getRow, { index }).then(
      (row) => {
        if (!current) return;
        if (row.ok) setCells(row.cells);
        else setFailed(true);
      },
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [index]);

  const { values, unmapped } = useMemo(
    () => rowValues(keys, entries, columns, cells ?? []),
    [keys, entries, columns, cells],
  );

  const last = Math.max(rowCount - 1, 0);
  return (
    <section
      aria-label={t.previewLabel}
      className="flex flex-col gap-3 min-[1000px]:sticky min-[1000px]:top-4"
    >
      <div role="group" aria-label={t.pagerLabel} className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={t.prev}
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <span data-testid="pager" aria-live="polite" className="min-w-24 text-center font-semibold">
          {t.row(index + 1, rowCount)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t.next}
          disabled={index >= last}
          onClick={() => setIndex((i) => Math.min(i + 1, last))}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {failed ? <Status kind="danger">{t.rowFailed}</Status> : null}
      <div
        data-testid="mapping-preview"
        className="max-h-[70vh] overflow-auto rounded-control border border-line"
      >
        {cells ? <WordPreview template={template} values={values} unmapped={unmapped} /> : null}
      </div>
    </section>
  );
}
