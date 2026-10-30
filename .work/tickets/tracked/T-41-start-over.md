# T-41: Start over from any step

**Type:** feature
**Parent:** E-4 (#32)
**Requirements:** none
**Blocked by:** None (can start immediately)
**Status:** in-review
**Tracker:** #34
**New infrastructure:** none
**Files:** src/renderer/pages/home/HomePage.tsx, src/renderer/strings/home.ts, docs/specification.md, tests/e2e/home-mapping.spec.ts
**Proof:** e2e "Start over asks first, keeps everything on cancel and returns to step 1 on confirm" passes.
**Step:** close
**Base:** 4fdf665

**What to build:** A "Start over" button (after a file is chosen, not while exporting) that asks, then clears the run and returns to step 1.

- [x] Visible once started, hidden on a fresh page and while an export runs
- [x] Confirmation names what is dropped; cancel changes nothing
- [x] Confirm clears data, template, mapping and opens step 1
- [x] vi + en strings, spec, e2e

## Result
Goal: let a user at any step add a new template and restart from the beginning (the tester's real "cannot cancel" complaint).

Changed: `HomePage` shows the button through the page `actions` slot and a confirm `Dialog`; confirm calls the existing `exportRun.newBatch()` (reset data in main, drop the draft, `flow.reset()`), so no new main-process code. Strings in `home.ts`; spec updated.

Proof: biome, `tsc` clean; `home-mapping` and `flow` e2e 7 passed at 1024x768. Verdict: VERIFIED.
ASK: where does the button go? -> page header, always the same place on every step. Rejected: one button per step (clutter).
Applied: test-plan (light, inline); skip: review: small UI change reusing existing reset.
