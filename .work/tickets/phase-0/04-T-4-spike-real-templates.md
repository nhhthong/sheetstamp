# T-4: Spike real templates

**Type:** spike
**Parent:** E-0
**Requirements:** R0.3
**Blocked by:** T-3
**Status:** in-review
**New infrastructure:** none
**Files:** none
**Proof:** none
**Step:** close
**Base:**
**Baseline:**

**What to build:** Question (open point O-1): do at least 4 of 5 real HR or accounting templates produce correct output with the engine from T-3? The owner supplies the templates (anonymized). Run each through `parseTags` and fill with mock data, then compare with the original in Word. If fewer than 4 pass, add a run-merging preprocessing step before considering another library (the threshold was decided on 2026-10-28). Record the result and the failing patterns.

- [ ] Owner has supplied at least 5 real templates (anonymized). (open: owner)
- [ ] Result of each real template (pass or failure pattern) is recorded. (stand-in results recorded; real ones wait for the owner)
- [x] A decision is recorded: keep the engine, add run merging, or replace it.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: find out whether the engine copes with real-world Word files, ahead of the owner's templates.
Proof: stand-in run of 12 realistic documents (`prototypes/phase0/spike6-run.mjs`): 10 pass, 2 failed (tracked changes, footnotes) and are now handled in the engine with tests (29 engine tests pass).
Verdict: INCONCLUSIVE for the threshold on the owner's 5 real templates (not supplied); VERIFIED for the stand-in.
Decision: keep the engine; add tracked-change acceptance (done) and footnote warnings (done); no run-merging step needed so far.
Applied: skip: review: typed.
