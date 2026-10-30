import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type FieldMapping,
  getImageSource,
  getTemplateBytes,
  type ImageSource,
  type MappingView,
  openMapping,
  setEntry,
} from "../../../shared/ipc/mapping";
import { countUnresolved, type Entries, fillInOrder } from "../../../shared/mapping/values";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { WordPreview } from "../../preview/WordPreview";
import { homeMapping as t } from "../../strings/home-mapping";
import { flow } from "./flow";
import { FieldRow } from "./mapping-field-row";
import { ImagePreview } from "./mapping-image-preview";
import { MappingPreview } from "./mapping-preview";
import { markMappingDone, watchMappingInputs } from "./mapping-stale";
import { StepFooter } from "./Stepper";

watchMappingInputs();

type Body =
  | { kind: "word"; template: Uint8Array }
  | { kind: "image"; source: ImageSource & { ok: true } };
type Loaded = { view: MappingView; body: Body };
type Load =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | ({ kind: "ready" } & Loaded);

/**
 * Step 3, Ghép cột. Main loads the template and the data, matches the columns and saves the result with the
 * template; this component shows what is left to decide and the real result for any row. Each change is saved
 * at once. The table never reaches this file: only column names, the row count and the one row being previewed.
 */
export function StepMapping() {
  const templateId = flow.result<{ templateId: string }>("template")?.templateId ?? null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const start = useCallback(async () => {
    setLoad({ kind: "loading" });
    if (!templateId) return setLoad({ kind: "failed", message: t.loadError });
    try {
      const opened = await call(openMapping, { templateId });
      if (!opened.ok) return setLoad({ kind: "failed", message: opened.message });
      if (opened.view.kind === "image") {
        const source = await call(getImageSource, { templateId });
        if (!source.ok) return setLoad({ kind: "failed", message: source.message });
        return setLoad({ kind: "ready", view: opened.view, body: { kind: "image", source } });
      }
      const bytes = await call(getTemplateBytes, { templateId });
      if (!bytes.ok) return setLoad({ kind: "failed", message: bytes.message });
      setLoad({ kind: "ready", view: opened.view, body: { kind: "word", template: bytes.docx } });
    } catch {
      setLoad({ kind: "failed", message: t.loadError });
    }
  }, [templateId]);

  useEffect(() => {
    void start();
  }, [start]);

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind === "failed" || !templateId) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Status kind="danger">{load.kind === "failed" ? load.message : t.loadError}</Status>
        <Button variant="secondary" onClick={() => void start()}>
          {t.retry}
        </Button>
      </div>
    );
  }
  return <Mapping templateId={templateId} view={load.view} body={load.body} />;
}

function Mapping({
  templateId,
  view,
  body,
}: {
  templateId: string;
  view: MappingView;
  body: Body;
}) {
  const [entries, setEntries] = useState<Entries>(view.entries);
  const [showMatched, setShowMatched] = useState(false);
  const [error, setError] = useState("");
  // Fields that gave their column to another field. They stay in the list of fields to settle, and show the
  // alert until the user chooses again.
  const [moved, setMoved] = useState<ReadonlySet<string>>(new Set());
  const [taken, setTaken] = useState<ReadonlySet<string>>(new Set());

  const keys = useMemo(() => view.fields.map((f) => f.key), [view]);
  const pinned = useMemo(() => new Set([...view.unmatched, ...moved]), [view, moved]);
  const first = view.fields.filter((f) => pinned.has(f.key));
  const matched = view.fields.filter((f) => !pinned.has(f.key));
  const labelOf = useMemo(() => new Map(view.fields.map((f) => [f.key, f.label])), [view]);
  const left = countUnresolved(keys, entries);

  function change(key: string, entry: FieldMapping | null) {
    setEntries((now) => {
      const { [key]: _old, ...rest } = now;
      if (!entry) return rest;
      if (entry.kind !== "column") return { ...rest, [key]: entry };
      const kept = Object.entries(rest).filter(
        ([, other]) => !(other.kind === "column" && other.column === entry.column),
      );
      return { ...Object.fromEntries(kept), [key]: entry };
    });
    setTaken((now) => new Set([...now].filter((k) => k !== key)));
    setError("");
    call(setEntry, { templateId, key, entry }).then(
      (result) => {
        if (!result.ok) return setError(result.message);
        if (result.cleared.length === 0) return;
        setMoved((now) => new Set([...now, ...result.cleared]));
        setTaken((now) => new Set([...now, ...result.cleared]));
      },
      () => setError(t.saveFailed),
    );
  }

  function matchInOrder() {
    for (const [key, column] of fillInOrder(keys, entries, view.columns)) {
      change(key, { kind: "column", column });
    }
  }

  function next() {
    markMappingDone();
    flow.complete("mapping", {
      summary: t.summary(view.fields.length),
      result: { templateId },
    });
  }

  const valueOf = (entry: FieldMapping | undefined): string | undefined => {
    if (entry?.kind !== "column") return undefined;
    return view.firstRow[view.columns.indexOf(entry.column)] ?? "";
  };

  const row = (field: { key: string; label: string }) => (
    <FieldRow
      key={field.key}
      label={field.label}
      entry={entries[field.key]}
      columns={view.columns}
      pinned={pinned.has(field.key)}
      value={valueOf(entries[field.key])}
      taken={taken.has(field.key)}
      onChange={(entry) => change(field.key, entry)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid gap-6 ${body.kind === "word" ? "" : "min-[1000px]:grid-cols-2"}`}>
        <div className="flex min-w-0 flex-col gap-4">
          {view.lost.length > 0 ? (
            <div role="status" data-testid="lost-fields" className="flex flex-col gap-1">
              <Status kind="warning">{t.lostTitle}</Status>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-7">
                {view.lost.map((l) => (
                  <li key={l.field}>
                    {t.lost(labelOf.get(l.field) ?? l.field, l.previous, l.replacedBy)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <h3 data-testid="mapping-heading" className="text-lg font-semibold">
            {view.fields.length === 0
              ? t.noFields
              : left > 0
                ? t.needWork(left)
                : t.allDone(view.fields.length)}
          </h3>

          {left > 0 && view.columns.length > 0 ? (
            <Button variant="secondary" className="self-start" onClick={matchInOrder}>
              {t.matchInOrder}
            </Button>
          ) : null}

          {first.length > 0 ? (
            <ul aria-label={t.listLabel} className="m-0 flex list-none flex-col gap-3 p-0">
              {first.map(row)}
            </ul>
          ) : null}

          {matched.length > 0 ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                aria-expanded={showMatched}
                onClick={() => setShowMatched((v) => !v)}
                className="self-start rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-panel"
              >
                {showMatched ? t.hideMatched(matched.length) : t.showMatched(matched.length)}
              </button>
              {showMatched ? (
                <ul aria-label={t.matchedLabel} className="m-0 flex list-none flex-col gap-3 p-0">
                  {matched.map(row)}
                </ul>
              ) : null}
            </div>
          ) : null}
          {error ? <Status kind="danger">{error}</Status> : null}
        </div>

        <MappingPreview
          draw={({ values, unmapped }) =>
            body.kind === "word" ? (
              <WordPreview template={body.template} values={values} unmapped={unmapped} />
            ) : (
              <ImagePreview
                source={body.source}
                values={values}
                unmapped={unmapped}
                labelOf={(key) => labelOf.get(key) ?? key}
              />
            )
          }
          keys={keys}
          entries={entries}
          columns={view.columns}
          rowCount={view.rowCount}
          wide={body.kind === "word"}
        />
      </div>

      <StepFooter>
        <Button size="lg" disabled={left > 0} onClick={next}>
          {t.continue}
        </Button>
      </StepFooter>
    </div>
  );
}
