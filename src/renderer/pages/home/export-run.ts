// The export run as the renderer sees it: one module-level store (like ./flow.ts), so the progress survives the
// step being unmounted and every part of step 4 reads the same state. The work itself happens in main.
import { useSyncExternalStore } from "react";
import { clear } from "../../../shared/ipc/data";
import {
  cancel,
  type ExportDone,
  type ExportProgress,
  type FailureCode,
  progress,
  start,
} from "../../../shared/ipc/export";
import { call, listen } from "../../lib/ipc";
import { homeExport as t } from "../../strings/home-export";
import { type Chip } from "./export-pattern";
import { flow } from "./flow";

export type Run =
  | { kind: "idle" }
  | { kind: "running"; done: number; total: number; failed: number; canceling: boolean }
  | { kind: "canceled" }
  | { kind: "failed"; code: FailureCode }
  | { kind: "finished"; result: ExportDone; inputs: string };

/** What the earlier steps finished with; a finished export is only shown while these have not changed. */
export const inputsKey = (): string => {
  const { revision } = flow.getState();
  return `${revision.data}.${revision.template}.${revision.mapping}`;
};

/** The pattern being edited, kept while the user leaves the step and comes back. */
export type Draft = { templateId: string; chips: Chip[]; removeDiacritics: boolean };

let run: Run = { kind: "idle" };
let draft: Draft | undefined;
const listeners = new Set<() => void>();

function set(next: Run) {
  run = next;
  for (const listener of listeners) listener();
}

export const exportRun = {
  get: () => run,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  draft: () => draft,
  setDraft(next: Draft | undefined) {
    draft = next;
  },
  /** Back to the options (after a cancel, a failure, or when the inputs changed). */
  dismiss() {
    if (run.kind !== "running") set({ kind: "idle" });
  },

  /**
   * Start the export. While it runs the Home flow cannot leave step 4: the earlier steps look "done" so their
   * "Đổi" links exist, and a click on one is bounced back here. Together with main copying the rows, the mapping
   * and the template at the start, the data and the mapping cannot change under a running export.
   */
  async start(
    request: { templateId: string; pattern: string; removeDiacritics: boolean },
    total: number,
  ) {
    if (run.kind === "running") return;
    set({ kind: "running", done: 0, total, failed: 0, canceling: false });
    flow.complete("export", { summary: t.running.title(0, total) });
    const stopGuard = flow.subscribe(() => {
      if (run.kind === "running" && flow.getState().active !== "export") flow.reopen("export");
    });
    const stopProgress = listen(progress, (p: ExportProgress) => {
      if (run.kind === "running") set({ ...run, done: p.done, total: p.total, failed: p.failed });
    });
    let outcome: Run;
    try {
      const result = await call(start, request);
      if (result.ok) outcome = { kind: "finished", result: result.done, inputs: inputsKey() };
      else if (result.canceled) outcome = { kind: "canceled" };
      else outcome = { kind: "failed", code: result.code };
    } catch {
      outcome = { kind: "failed", code: "unknown" };
    }
    stopProgress();
    stopGuard();
    // The export step is the active one but not "done": a later "Tiếp tục" in an earlier step must come back here.
    flow.invalidate("export");
    set(outcome);
  },

  async cancel() {
    if (run.kind !== "running" || run.canceling) return;
    set({ ...run, canceling: true });
    await call(cancel).catch(() => undefined);
  },

  /** "Tạo đợt mới": the data in main, the flow and this run all go back to the start. */
  async newBatch() {
    await call(clear).catch(() => undefined);
    draft = undefined;
    set({ kind: "idle" });
    flow.reset();
  },
};

export const useExportRun = (): Run =>
  useSyncExternalStore(exportRun.subscribe, exportRun.get, exportRun.get);
