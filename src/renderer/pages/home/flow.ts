import { useSyncExternalStore } from "react";

/**
 * The state of the four-step flow on the Home page. It lives outside React so every step file can read
 * and write it, and it survives leaving the page and coming back (it is gone after a restart, like the data).
 *
 * API for step files:
 *  - `useFlow()`                         the current `FlowState` (re-renders on change)
 *  - `flow.getState()`                   the same, without subscribing
 *  - `flow.complete(step, { summary, result? })`
 *        mark `step` done, store its one-line summary and what it finished with, bump its revision, and
 *        make the first step that is not done the active one (so after reopening an earlier step, the
 *        user lands on the first step still to do, with later valid choices kept)
 *  - `flow.reopen(step)`                 the "Đổi" link: make a done step active; other steps keep their state
 *  - `flow.invalidate(step, reason?)`    a step's earlier choice stopped being valid: it is no longer done
 *        (summary and result dropped); if it was the active one, nothing else changes. Later steps that depend
 *        on it call this themselves by comparing `revision` values.
 *  - `flow.setSummary(step, text)`       change the summary line of a done step without finishing it again
 *  - `flow.setResult(step, value)`       store what a step finished with, without changing its state
 *  - `flow.reset()`                      back to the start
 *  - `stepStatus(state, step)`           "active" | "done" | "locked" (what the Stepper shows)
 *  - `flow.result<T>(step)`              the stored result, typed by the caller
 *  - `revision[step]`                    how many times the step was completed; a later step stores the
 *        revision of its input when it finishes and compares it to know when its own result is stale
 *
 * Rules: a step is `active` (the one expanded), `done` (finished; stays done while an earlier step is reopened,
 * so its choice is kept), or `locked` (not finished and not active). Locked steps cannot be opened: the
 * only way forward is the primary button of the active step, which calls `complete`.
 */
export const STEP_IDS = ["data", "template", "mapping", "export"] as const;
export type StepId = (typeof STEP_IDS)[number];
export type StepStatus = "active" | "done" | "locked";

export type FlowState = {
  active: StepId;
  done: Readonly<Record<StepId, boolean>>;
  summaries: Readonly<Partial<Record<StepId, string>>>;
  results: Readonly<Partial<Record<StepId, unknown>>>;
  revision: Readonly<Record<StepId, number>>;
};

const initial = (): FlowState => ({
  active: "data",
  done: { data: false, template: false, mapping: false, export: false },
  summaries: {},
  results: {},
  revision: { data: 0, template: 0, mapping: 0, export: 0 },
});

export function stepStatus(state: FlowState, step: StepId): StepStatus {
  if (state.active === step) return "active";
  return state.done[step] ? "done" : "locked";
}

let state = initial();
const listeners = new Set<() => void>();

function set(next: FlowState) {
  state = next;
  for (const listener of listeners) listener();
}

const without = <T extends object>(record: T, key: StepId): T => {
  const { [key]: _removed, ...rest } = record as Record<string, unknown>;
  return rest as T;
};

export const flow = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  result<T>(step: StepId): T | undefined {
    return state.results[step] as T | undefined;
  },
  complete(step: StepId, finished: { summary: string; result?: unknown }) {
    const done = { ...state.done, [step]: true };
    const next = STEP_IDS.find((id) => !done[id]);
    set({
      active: next ?? step,
      done,
      summaries: { ...state.summaries, [step]: finished.summary },
      results: { ...state.results, [step]: finished.result },
      revision: { ...state.revision, [step]: state.revision[step] + 1 },
    });
  },
  reopen(step: StepId) {
    if (stepStatus(state, step) !== "done") return;
    set({ ...state, active: step });
  },
  invalidate(step: StepId) {
    const wasActive = state.active === step;
    set({
      ...state,
      active: wasActive ? step : state.active,
      done: { ...state.done, [step]: false },
      summaries: without(state.summaries, step),
      results: without(state.results, step),
    });
  },
  setSummary(step: StepId, summary: string) {
    set({ ...state, summaries: { ...state.summaries, [step]: summary } });
  },
  setResult(step: StepId, value: unknown) {
    set({ ...state, results: { ...state.results, [step]: value } });
  },
  reset() {
    set(initial());
  },
};

export const useFlow = (): FlowState =>
  useSyncExternalStore(flow.subscribe, flow.getState, flow.getState);
