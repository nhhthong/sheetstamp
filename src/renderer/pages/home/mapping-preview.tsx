import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getRow } from "../../../shared/ipc/mapping";
import { type Entries, rowValues } from "../../../shared/mapping/values";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeMapping as t } from "../../strings/home-mapping";

export type MappingPreviewProps = {
  /** Draws the current row: the Word preview or the rendered image. */
  draw: (row: { values: Record<string, string>; unmapped: string[] }) => ReactNode;
  keys: readonly string[];
  entries: Entries;
  columns: readonly string[];
  rowCount: number;
  /** Full width under the fields, with zoom buttons (a Word document); otherwise it sits beside the fields. */
  wide?: boolean;
};

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Sticky preview with a pager. Only one row is fetched at a time (there is no list of rows, so 50,000 rows
 * cost the same as 2). The values come from that row through the mapping, so a change of mapping redraws
 * with the row already in hand.
 */
export function MappingPreview({
  draw,
  keys,
  entries,
  columns,
  rowCount,
  wide = false,
}: MappingPreviewProps) {
  const [index, setIndex] = useState(0);
  const [zoomAt, setZoomAt] = useState(ZOOMS.indexOf(1));
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
      className={`flex flex-col gap-3 ${wide ? "" : "min-[1000px]:sticky min-[1000px]:top-4"}`}
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
        {wide ? (
          <div role="group" aria-label={t.zoomLabel} className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.zoomOut}
              disabled={zoomAt <= 0}
              onClick={() => setZoomAt((z) => Math.max(z - 1, 0))}
            >
              <ZoomOut aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.zoomReset}
              data-testid="zoom"
              onClick={() => setZoomAt(ZOOMS.indexOf(1))}
            >
              {Math.round((ZOOMS[zoomAt] ?? 1) * 100)}%
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.zoomIn}
              disabled={zoomAt >= ZOOMS.length - 1}
              onClick={() => setZoomAt((z) => Math.min(z + 1, ZOOMS.length - 1))}
            >
              <ZoomIn aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {failed ? <Status kind="danger">{t.rowFailed}</Status> : null}
      <div
        data-testid="mapping-preview"
        className={`overflow-auto rounded-control border border-line ${wide ? "h-[60vh]" : "max-h-[70vh]"}`}
      >
        <div style={wide ? { zoom: ZOOMS[zoomAt] } : undefined}>
          {cells ? draw({ values, unmapped }) : null}
        </div>
      </div>
    </section>
  );
}
