import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ExportView,
  example,
  openExport,
  type PatternProblemView,
  pickFolder,
  savePattern,
  setDiacritics,
} from "../../../shared/ipc/export";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeExport as t } from "../../strings/home-export";
import { ExportEditor } from "./export-editor";
import { type Chip, chipsOf, patternOf } from "./export-pattern";
import { flow } from "./flow";
import { StepFooter } from "./Stepper";

type Load =
  | { kind: "loading" }
  | { kind: "failed"; code: string }
  | { kind: "ready"; view: ExportView };

/** The pattern being edited, kept while the user leaves the step and comes back. */
let draft: { templateId: string; chips: Chip[]; removeDiacritics: boolean } | undefined;

/**
 * Step 4, Xuất file (options). Main reads the data, the stored mapping and the template; this component edits the
 * filename pattern and shows what main says the first name will be. The export itself comes with T-23.
 */
export function StepExport() {
  const templateId = flow.result<{ templateId: string }>("template")?.templateId ?? null;
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
  return <Options templateId={templateId} view={load.view} />;
}

function Options({ templateId, view }: { templateId: string; view: ExportView }) {
  const resumed = draft?.templateId === templateId ? draft : undefined;
  const [chips, setChips] = useState<Chip[]>(resumed?.chips ?? chipsOf(view.pattern));
  const [removeDiacritics, setRemoveDiacritics] = useState(view.removeDiacritics);
  const [folder, setFolder] = useState(view.folder);
  const [folderError, setFolderError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [problems, setProblems] = useState<PatternProblemView[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const ask = useRef(0);
  const pattern = patternOf(chips);

  // The example comes from main for the first row, the mapping and the real planner; the newest answer wins.
  useEffect(() => {
    const mine = ++ask.current;
    call(example, { templateId, pattern, removeDiacritics }).then(
      (result) => {
        if (mine !== ask.current || !result.ok) return;
        setProblems(result.problems);
        setName(result.example);
      },
      () => undefined,
    );
  }, [templateId, pattern, removeDiacritics]);

  useEffect(() => {
    draft = { templateId, chips, removeDiacritics };
  }, [templateId, chips, removeDiacritics]);

  // With a problem the editor opens by itself, so the message and the fix are in front of the user.
  const invalid = problems.length > 0;
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
          disabled={invalid}
          aria-describedby={invalid ? "export-blocked" : undefined}
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
