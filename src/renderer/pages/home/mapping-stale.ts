import { flow, STEP_IDS } from "./flow";

/**
 * Step 3 is only mounted while it is active, so it cannot see the earlier steps finish again. This watcher
 * lives for the whole session: when the data or the template step is completed again after the mapping was
 * finished, the mapping is no longer valid. It is invalidated, and if the flow had already moved past it the
 * user is brought back to it (reopen, then invalidate, so it is the active step and not done).
 */
let seen: { data: number; template: number } | null = null;

/** Called when step 3 finishes: remember which data and template it was made for. */
export function markMappingDone() {
  const { revision } = flow.getState();
  seen = { data: revision.data, template: revision.template };
}

function check() {
  const state = flow.getState();
  if (!seen || !state.done.mapping) return;
  if (state.revision.data === seen.data && state.revision.template === seen.template) return;
  seen = null;
  if (STEP_IDS.indexOf(state.active) > STEP_IDS.indexOf("mapping")) flow.reopen("mapping");
  flow.invalidate("mapping");
}

let started = false;
export function watchMappingInputs() {
  if (started) return;
  started = true;
  flow.subscribe(check);
}
