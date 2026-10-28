import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  current,
  type DataResult,
  type DataSnapshot,
  ENCODING_CHOICES,
  openPath,
  padColumn,
  pickFile,
  reload,
  type SnapshotWarning,
  setEncoding,
  setSheet,
} from "../../../shared/ipc/data";
import { Button } from "../../components/ui/button";
import { Field, Input, Select } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/cn";
import { call } from "../../lib/ipc";
import { home } from "../../strings/home";
import { flow } from "./flow";
import { StepFooter } from "./Stepper";

const t = home.data;

function errorText(result: Extract<DataResult, { ok: false }>): string {
  if (!("error" in result)) return "";
  if (result.error.message) return result.error.message;
  const known = t.errors as Record<string, string>;
  return known[result.error.code] ?? t.errors.generic;
}

/** Step 1, Dữ liệu: drop or choose a file, check how it was read, fix what is wrong. */
export function StepData() {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showEncoding, setShowEncoding] = useState(false);
  const dragDepth = useRef(0);

  // What main holds now. After a restart it is nothing, and a step that claimed to be done is not.
  const refresh = useCallback(async () => {
    const { snapshot: next } = await call(current);
    setSnapshot(next);
    setLoaded(true);
    if (!next && flow.getState().done.data) flow.invalidate("data");
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  /** Run a command; a snapshot replaces the shown table, a failure shows its message and keeps the old table. */
  async function run(command: () => Promise<DataResult>): Promise<boolean> {
    setBusy(true);
    try {
      const result = await command();
      if (result.ok) {
        setSnapshot(result.snapshot);
        setError("");
        return true;
      }
      if ("error" in result) setError(errorText(result));
      return false;
    } catch {
      setError(t.errors.generic);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openFile(command: () => Promise<DataResult>) {
    if (await run(command)) setShowEncoding(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file || busy) return;
    const path = window.sheetstamp.pathForFile(file);
    if (!path) {
      setError(t.errors.generic);
      return;
    }
    void openFile(() => call(openPath, { path }));
  }

  const dragProps = {
    onDragEnter: (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop,
  };

  function finish() {
    if (!snapshot) return;
    flow.complete("data", {
      summary: t.summary(snapshot.fileName, snapshot.rowCount, snapshot.columnCount),
      result: { fileName: snapshot.fileName, rows: snapshot.rowCount, columns: snapshot.columns },
    });
  }

  async function doReload() {
    if (await run(() => call(reload))) toast.show(t.reloaded);
  }

  if (!loaded) return <p className="text-muted">{t.reading}</p>;

  if (!snapshot) {
    return (
      <div {...dragProps}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void openFile(() => call(pickFile))}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-dialog border-2 border-dashed px-6 py-12 text-center",
            dragging ? "border-accent bg-panel" : "border-line",
          )}
        >
          <FileSpreadsheet aria-hidden="true" className="size-10 text-muted" />
          <span className="text-lg font-semibold">
            {busy ? t.reading : dragging ? t.dropActive : t.dropTitle}
          </span>
          <span className="text-muted">{t.dropHint}</span>
        </button>
        {error ? (
          <Status kind="danger" className="mt-4">
            {error}
          </Status>
        ) : null}
      </div>
    );
  }

  return (
    <div {...dragProps} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 font-semibold">
          <FileSpreadsheet aria-hidden="true" className="size-5 text-muted" />
          <span data-testid="file-name">{snapshot.fileName}</span>
          <span className="font-normal text-muted" data-testid="file-counts">
            {t.counts(snapshot.rowCount, snapshot.columnCount)}
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void openFile(() => call(pickFile))}
        >
          {t.pickAnother}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void doReload()}
          title={t.reloadHint}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {t.reload}
        </Button>
      </div>

      {dragging ? <Status kind="info">{t.dropActive}</Status> : null}
      {error ? <Status kind="danger">{error}</Status> : null}
      {snapshot.changedOnDisk ? <Status kind="warning">{t.changed}</Status> : null}

      {snapshot.sheets.length > 1 && snapshot.sheet !== undefined ? (
        <div className="max-w-xs">
          <Field label={t.sheetLabel}>
            {(props) => (
              <Select
                {...props}
                value={snapshot.sheet}
                disabled={busy}
                onChange={(event) => void run(() => call(setSheet, { sheet: event.target.value }))}
              >
                {snapshot.sheets.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ) : null}

      <PreviewTable snapshot={snapshot} />

      <Warnings
        snapshot={snapshot}
        busy={busy}
        onPad={(columnIndex, width) => void run(() => call(padColumn, { columnIndex, width }))}
      />

      {snapshot.encoding ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted">
            {t.encodingHint}{" "}
            <button
              type="button"
              aria-expanded={showEncoding}
              onClick={() => setShowEncoding((open) => !open)}
              className="rounded-control font-semibold text-accent underline"
            >
              {t.encodingLink}
            </button>
          </p>
          {showEncoding ? (
            <div className="max-w-xs">
              <Field label={t.encodingLabel} hint={t.encodingHelp}>
                {(props) => (
                  <Select
                    {...props}
                    value={snapshot.encoding}
                    disabled={busy}
                    onChange={(event) =>
                      void run(() =>
                        call(setEncoding, {
                          encoding: event.target.value as (typeof ENCODING_CHOICES)[number],
                        }),
                      )
                    }
                  >
                    {ENCODING_CHOICES.map((name) => (
                      <option key={name} value={name}>
                        {t.encodings[name]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      <StepFooter>
        <Button disabled={busy} onClick={finish}>
          {t.continue}
        </Button>
      </StepFooter>
    </div>
  );
}

function PreviewTable({ snapshot }: { snapshot: DataSnapshot }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full border-collapse text-left text-sm" data-testid="preview">
        <caption className="sr-only">{t.previewCaption(snapshot.previewRows.length)}</caption>
        <thead className="bg-panel">
          <tr>
            {snapshot.columns.map((name, i) => (
              <th
                key={i}
                scope="col"
                className="border-b border-line px-3 py-2 font-semibold whitespace-nowrap"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.previewRows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-b-0">
              {row.map((cell, c) => (
                <td key={c} className="max-w-[260px] truncate px-3 py-2" title={cell}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Warnings({
  snapshot,
  busy,
  onPad,
}: {
  snapshot: DataSnapshot;
  busy: boolean;
  onPad: (columnIndex: number, width: number) => void;
}) {
  const padded = snapshot.paddedColumns;
  if (snapshot.warnings.length === 0 && padded.length === 0) return null;
  return (
    <ul aria-label={t.warningsTitle} className="m-0 flex list-none flex-col gap-3 p-0">
      {padded.map((index) => (
        <li key={`padded-${index}`}>
          <Status kind="success">{t.padded(snapshot.columns[index] ?? "")}</Status>
        </li>
      ))}
      {snapshot.warnings.map((warning) => (
        <li key={`${snapshot.fileName}-${snapshot.sheet}-${warning.kind}-${warning.columnIndex}`}>
          <WarningRow warning={warning} busy={busy} onPad={onPad} />
        </li>
      ))}
    </ul>
  );
}

function WarningRow({
  warning,
  busy,
  onPad,
}: {
  warning: SnapshotWarning;
  busy: boolean;
  onPad: (columnIndex: number, width: number) => void;
}) {
  const [width, setWidth] = useState(
    warning.kind === "id-stored-as-number" ? (warning.suggestedWidth ?? warning.width) : 0,
  );
  switch (warning.kind) {
    case "empty-cells":
      return <Status kind="warning">{t.emptyCells(warning.count, warning.column)}</Status>;
    case "mixed-types":
      return <Status kind="warning">{t.mixedTypes(warning.column)}</Status>;
    case "id-stored-as-number":
      return (
        <div className="flex flex-col gap-2">
          <Status kind="warning">{t.idAsNumber(warning.column)}</Status>
          <div className="flex flex-wrap items-end gap-3 pl-7">
            <div className="w-28">
              <Field label={t.padLabel(warning.column)}>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={1}
                    max={64}
                    value={width}
                    onChange={(event) => setWidth(Number(event.target.value))}
                  />
                )}
              </Field>
            </div>
            <Button
              variant="secondary"
              disabled={busy || !Number.isInteger(width) || width < 1 || width > 64}
              onClick={() => onPad(warning.columnIndex, width)}
            >
              {t.padAction}
            </Button>
          </div>
        </div>
      );
  }
}
