# T-2: Spike canvas packaged

**Type:** spike
**Parent:** E-0
**Requirements:** R0.4, R14.1, R14.6
**Blocked by:** T-1
**Status:** in-review
**New infrastructure:** none
**Files:** none
**Proof:** none
**Step:** close
**Base:**
**Baseline:**

**What to build:** Question (open point O-4): does `@napi-rs/canvas` run correctly in the background process of the packaged app on Windows 10/11 and Ubuntu 22.04/24.04? Prototype spike4 already showed it draws Vietnamese diacritics in a `worker_thread` on Linux with plain Node.

Try both a `worker_thread` and an Electron `utilityProcess` as the background process, with the `.node` file unpacked (`asarUnpack`) in an electron-builder package. Render the four styles (Normal, Bold, Italic, Bold Italic) of an installed family and check the output on clean machines or CI runners. Also check whether a font installed while the app runs appears in `GlobalFonts` (after `loadSystemFonts` or a restart). Decide which background process to use and record the evidence (commit, output) with the decision.

- [x] A decision is recorded in `.work/notes.md` (background process type, how the `.node` file is unpacked) with the evidence.
- [x] Packaged builds on Windows and Ubuntu render the four styles with correct diacritics.
- [x] The answer on fonts installed at runtime is recorded for each OS.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: decide the background process for canvas work and prove it in packaged builds.
Decision: `@napi-rs/canvas` pinned to 1.0.11, run in `worker_thread` pool; `.node` unpacked from ASAR (automatic plus rule); rescan font folders with `loadFontsFromDir` to see fonts installed at runtime.
Proof: CI run `Canvas spike (T-2)` passed on ubuntu-latest and windows-latest (probe OK: both modes, four styles, identical hashes, runtime font install visible); local Linux packaged run identical.
Verdict: VERIFIED.
Applied: skip: review: typed; plan-proof tier check (the existing probe command).
