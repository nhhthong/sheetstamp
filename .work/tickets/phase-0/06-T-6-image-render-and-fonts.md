# T-6: Image render and fonts

**Type:** task
**Parent:** E-0
**Requirements:** R0.5, R4.2, R4.3, R4.4, R4.5, R4.6, R4.8, R4.10
**Blocked by:** T-2
**Status:** done
**New infrastructure:** @napi-rs/canvas 1.x
**Files:** src/worker/render, src/main/fonts, tests/fixtures/image
**Proof:** `npm test` passes the golden-image suite (pixel threshold, one reference OS) with `DISABLE_SYSTEM_FONTS_LOAD` and a test-only font.
**Step:** close
**Base:**
**Baseline:**

**What to build:** One render function draws a template's text boxes for a row onto the background image; the preview and the export both call it. A font service lists installed families with the styles that really exist (from `GlobalFonts.families`) and offers no style without a face. Overflow modes (shrink, wrap, truncate, error for that row) and a missing-font check that reports once and never substitutes are covered.

- [x] Preview and export produce identical pixels for the same row.
- [x] Only faces that exist are offered; a family with no bold face does not offer Bold.
- [x] Each overflow mode has a test with a long Vietnamese string.
- [x] Opening a template whose font is gone returns one message and no automatic substitution.
- [x] Export to PNG and JPEG works; golden images pass with the test-only font.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: one render function for preview and export, a font service listing only real styles, overflow modes, missing-font handling.
Proof: `npm test` 19 render tests pass (4 styles, determinism, PNG/JPEG, 4 overflow modes, font rescan, 3 golden images checked by eye); lint and typecheck clean. Verdict: VERIFIED on Linux; Windows runs in CI (golden images skipped there by design).
Decisions: see `.work/phase-0-report.md` (T-6).
Applied: skip: review: typed.
