import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type FieldMapping,
  getTemplateBytes,
  type MappingView,
  openMapping,
  setEntry,
} from "../../../shared/ipc/mapping";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeMapping as t } from "../../strings/home-mapping";
import { flow } from "./flow";
import { FieldRow } from "./mapping-field-row";
import { MappingPreview } from "./mapping-preview";
import { markMappingDone, watchMappingInputs } from "./mapping-stale";
import { countUnresolved, type Entries } from "./mapping-values";
import { StepFooter } from "./Stepper";

watchMappingInputs();

type Loaded = { view: MappingView; template: Uint8Array };
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
      const [opened, bytes] = await Promise.all([
        call(openMapping, { templateId }),
        call(getTemplateBytes, { templateId }),
      ]);
      if (!opened.ok) return setLoad({ kind: "failed", message: opened.message });
      if (!bytes.ok) return setLoad({ kind: "failed", message: bytes.message });
      setLoad({ kind: "ready", view: opened.view, template: bytes.docx });
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
  return <Mapping templateId={templateId} view={load.view} template={load.template} />;
}

function Mapping({
  templateId,
  view,
  template,
}: {
  templateId: string;
  view: MappingView;
  template: Uint8Array;
}) {
  const [entries, setEntries] = useState<Entries>(view.entries);
  const [showMatched, setShowMatched] = useState(false);
  const [error, setError] = useState("");

  const keys = useMemo(() => view.fields.map((f) => f.key), [view]);
  const pinned = useMemo(() => new Set(view.unmatched), [view]);
  const first = view.fields.filter((f) => pinned.has(f.key));
  const matched = view.fields.filter((f) => !pinned.has(f.key));
  const labelOf = useMemo(() => new Map(view.fields.map((f) => [f.key, f.label])), [view]);
  const left = countUnresolved(keys, entries);

  function change(key: string, entry: FieldMapping | null) {
    setEntries((now) => {
      const { [key]: _old, ...rest } = now;
      return entry ? { ...rest, [key]: entry } : rest;
    });
    setError("");
    call(setEntry, { templateId, key, entry }).then(
      (result) => {
        if (!result.ok) setError(result.message);
      },
      () => setError(t.saveFailed),
    );
  }

  function next() {
    markMappingDone();
    flow.complete("mapping", {
      summary: t.summary(view.fields.length),
      result: { templateId },
    });
  }

  const row = (field: { key: string; label: string }) => (
    <FieldRow
      key={field.key}
      label={field.label}
      entry={entries[field.key]}
      columns={view.columns}
      pinned={pinned.has(field.key)}
      onChange={(entry) => change(field.key, entry)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 min-[1000px]:grid-cols-2">
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
          template={template}
          keys={keys}
          entries={entries}
          columns={view.columns}
          rowCount={view.rowCount}
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
