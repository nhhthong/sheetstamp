import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ExportBlocker,
  type ExportView,
  estimate,
  example,
  IMAGE_FORMATS,
  type ImageFormat,
  openExport,
  type PatternProblemView,
  pickFolder,
  savePattern,
  setDiacritics,
  setImageFormat,
} from "../../../shared/ipc/export";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeExport as t } from "../../strings/home-export";
import { ExportFinished } from "./export-done";
import { ExportEditor } from "./export-editor";
import { type Chip, chipsOf, patternOf } from "./export-pattern";
import { ExportProgress } from "./export-progress";
import { exportRun, inputsKey, useExportRun, viewVersion } from "./export-run";
import { flow } from "./flow";
import { StepFooter } from "./Stepper";

type Load =
  | { kind: "loading" }
  | { kind: "failed"; code: string }
  | { kind: "ready"; view: ExportView };

/**
 * Step 4, Xuất file. Main reads the data, the stored mapping and the template and writes the ZIP; this component
 * edits the filename pattern, shows what main says the first name will be, and drives the run store.
 */
export function StepExport() {
  const templateId = flow.result<{ templateId: string }>("template")?.templateId ?? null;
  const run = useExportRun();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const start = useCallback(async () => {
    setLoad({ kind: "loading" });
    if (!templateId) return setLoad({ kind: "failed", code: "no-template" });
    try {
      const opened = await call(openExport, { templateId });
      setLoad(
        opened.ok ? { kind: "ready", view: opened.view } : { kind: "failed", code: opened.code },
      );
    } catch {
      setLoad({ kind: "failed", code: "unknown" });
    }
  }, [templateId]);

  useEffect(() => {
    void start();
  }, [start]);

  // A finished export belongs to the data, template and mapping it used; when one of them changed, start over.
  useEffect(() => {
    if (run.kind === "finished" && run.inputs !== inputsKey()) exportRun.dismiss();
  }, [run]);

  if (run.kind === "running") return <ExportProgress run={run} />;
  if (run.kind === "finished" && run.inputs === inputsKey()) {
    return <ExportFinished result={run.result} onBack={() => exportRun.dismiss()} />;
  }

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind === "failed" || !templateId) {
    const code = load.kind === "failed" ? load.code : "no-template";
    return (
      <div className="flex flex-col items-start gap-3">
        <Status kind="danger">
          {code in t.failed ? t.failed[code as keyof typeof t.failed] : t.loadError}
        </Status>
        <Button variant="secondary" onClick={() => void start()}>
          {t.retry}
        </Button>
      </div>
    );
  }
  return <Options templateId={templateId} view={load.view} run={run} />;
}

function Options({
  templateId,
  view,
  run,
}: {
  templateId: string;
  view: ExportView;
  run: ReturnType<typeof useExportRun>;
}) {
  const version = viewVersion(view);
  // Resume the unsaved pattern only if the template's saved pattern and fields are still what it began from.
  const [resumed] = useState(() => exportRun.resume(templateId, version));
  const [chips, setChips] = useState<Chip[]>(resumed?.chips ?? chipsOf(view.pattern));
  const [removeDiacritics, setRemoveDiacritics] = useState(
    resumed?.removeDiacritics ?? view.removeDiacritics,
  );
  const [folder, setFolder] = useState(view.folder);
  const [folderError, setFolderError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [problems, setProblems] = useState<PatternProblemView[]>([]);
  const [format, setFormat] = useState<ImageFormat>(view.imageFormat);
  const [blocker, setBlocker] = useState<ExportBlocker | null>(view.blocker);
  const [size, setSize] = useState<"busy" | "none" | number>("busy");
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const ask = useRef(0);
  const pattern = patternOf(chips);

  // The example comes from main for the first row, the mapping and the real planner; the newest answer wins.
  useEffect(() => {
    const mine = ++ask.current;
    call(example, { templateId, pattern, removeDiacritics, imageFormat: format }).then(
      (result) => {
        if (mine !== ask.current || !result.ok) return;
        setProblems(result.problems);
        setName(result.example);
      },
      () => undefined,
    );
  }, [templateId, pattern, removeDiacritics, format]);

  // Image templates: the size comes from a few rows drawn in main; the newest answer wins.
  const sized = useRef(0);
  const image = view.kind === "image";
  useEffect(() => {
    if (!image || blocker) return;
    const mine = ++sized.current;
    setSize("busy");
    call(estimate, { templateId, imageFormat: format }).then(
      (result) => {
        if (mine !== sized.current) return;
        setSize(result.ok && result.bytes !== null ? result.bytes : "none");
      },
      () => mine === sized.current && setSize("none"),
    );
  }, [image, blocker, templateId, format]);

  // A font installed or a template fixed meanwhile: ask again when the window comes back, so the block lifts.
  useEffect(() => {
    if (!blocker) return;
    const recheck = () =>
      void call(openExport, { templateId }).then(
        (opened) => opened.ok && setBlocker(opened.view.blocker),
        () => undefined,
      );
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [blocker, templateId]);

  useEffect(() => {
    exportRun.setDraft({ templateId, version, chips, removeDiacritics });
  }, [templateId, version, chips, removeDiacritics]);

  // With a problem the editor opens by itself, so the message and the fix are in front of the user.
  const invalid = problems.length > 0;
  const blockedText =
    blocker === null
      ? ""
      : blocker.kind === "font-missing"
        ? t.blocked.fontMissing(blocker.fonts)
        : t.blocked[blocker.kind];
  useEffect(() => {
    if (invalid) setEditing(true);
  }, [invalid]);

  function changeChips(next: Chip[]) {
    setSaveState("idle");
    setChips(next);
  }

  function changeDiacritics(value: boolean) {
    setRemoveDiacritics(value);
    void call(setDiacritics, { removeDiacritics: value }).catch(() => undefined);
  }

  function changeFormat(value: ImageFormat) {
    setFormat(value);
    void call(setImageFormat, { imageFormat: value }).catch(() => undefined);
  }

  async function changeFolder() {
    setFolderError(false);
    try {
      const picked = await call(pickFolder);
      if (picked.ok) setFolder(picked.folder);
      else if (!picked.canceled) setFolderError(true);
    } catch {
      setFolderError(true);
    }
  }

  async function save() {
    const saved = await call(savePattern, { templateId, pattern }).catch(() => ({ ok: false }));
    setSaveState(saved.ok ? "saved" : "failed");
  }

  return (
    <div className="flex flex-col gap-4">
      {run.kind === "canceled" ? (
        <Status kind="info" alert focusOnMount>
          {t.canceled}
        </Status>
      ) : null}
      {run.kind === "failed" ? (
        <Status kind="danger" focusOnMount>
          {run.code === "font-missing" && run.fonts
            ? t.blocked.fontMissing(run.fonts)
            : t.failed[run.code]}
        </Status>
      ) : null}

      <dl className="m-0 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3">
        <dt className="font-semibold">{t.fileName}</dt>
        <dd className="m-0 min-w-0 break-all" data-testid="file-example">
          {name ?? (invalid ? t.exampleNone : t.exampleLoading)}
        </dd>
        <dd className="m-0">
          <ChangeLink label={t.changeFileName} onClick={() => setEditing(true)} />
        </dd>
        <dt className="font-semibold">{t.saveTo}</dt>
        <dd className="m-0 min-w-0 break-all" data-testid="export-folder">
          {folder}
        </dd>
        <dd className="m-0">
          <ChangeLink label={t.changeFolder} onClick={() => void changeFolder()} />
        </dd>
      </dl>
      {folderError ? <Status kind="danger">{t.folderFailed}</Status> : null}

      {image ? (
        <div className="flex flex-col gap-2" data-testid="image-options">
          <fieldset className="m-0 flex flex-wrap items-center gap-4 border-0 p-0">
            <legend className="float-left mr-4 font-semibold">{t.image.formatLabel}</legend>
            {IMAGE_FORMATS.map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="image-format"
                  value={value}
                  checked={format === value}
                  onChange={() => changeFormat(value)}
                  className="size-5 accent-[var(--accent)]"
                />
                {t.image[value]}
              </label>
            ))}
          </fieldset>
          <p className="m-0 text-muted">{t.image.pngNote}</p>
          {blocker === null ? (
            <p role="status" className="m-0" data-testid="size-estimate">
              {size === "busy"
                ? t.image.estimating
                : size === "none"
                  ? t.image.estimateNone
                  : t.image.estimate(megabytes(size))}
            </p>
          ) : null}
        </div>
      ) : null}
      {blocker ? (
        <Status kind="danger" alert>
          <span data-testid="export-blocker">{blockedText}</span>
        </Status>
      ) : null}

      {editing ? (
        <ExportEditor
          chips={chips}
          fields={view.fields}
          problems={problems}
          removeDiacritics={removeDiacritics}
          saveState={saveState}
          onChips={changeChips}
          onDiacritics={changeDiacritics}
          onSave={() => void save()}
          onDone={() => setEditing(false)}
        />
      ) : null}

      <StepFooter>
        <Button
          size="lg"
          disabled={invalid || blocker !== null}
          aria-describedby={invalid ? "export-blocked" : undefined}
          onClick={() =>
            void exportRun.start(
              { templateId, pattern, removeDiacritics, ...(image ? { imageFormat: format } : {}) },
              view.rowCount,
            )
          }
        >
          {t.export(view.rowCount)}
        </Button>
        {invalid ? (
          <span id="export-blocked" className="text-muted">
            {t.fixFirst}
          </span>
        ) : null}
      </StepFooter>
    </div>
  );
}

/** "12,5" for 12.5 million bytes; one decimal below 10 MB, whole numbers above. */
function megabytes(bytes: number): string {
  const mb = bytes / 1e6;
  return mb < 10
    ? mb.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : Math.round(mb).toLocaleString("vi-VN");
}

function ChangeLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-panel"
    >
      {t.change}
    </button>
  );
}
