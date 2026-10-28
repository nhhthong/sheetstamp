# T-14: Word preview

**Type:** task
**Parent:** E-1
**Requirements:** R9.4
**Blocked by:** T-13
**Status:** done
**New infrastructure:** docx-preview 0.4.1 (renderer), jszip
**Files:** src/renderer/preview, src/main/preview, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` shows a filled sample contract as pages, with filled values highlighted and an empty value shown as (trống) in red, for two different rows.
**Step:** deliver
**Base:** b9d2b697186d54569c4617486a7544c9e2abdf56
**Baseline:**

**What to build:** Show any row's result the way Word would: the main process fills the template with the real engine using marker characters around each value, and the renderer shows the bytes with docx-preview, highlights the values and prints `(trống)` in red for an empty one and `(thiếu)` for a tag with no mapping. Decision and evidence: `prototypes/phase1` (docx-preview over mammoth, which loses the header and footer).

- [x] The preview shows page layout, header, footer and table borders of a sample contract.
- [x] Filled values are highlighted; an empty value shows (trống) in red; an unmapped tag shows (thiếu).
- [x] Changing the row shows the new values in under 500 ms on the sample.
- [x] The preview never uses real export values in the markers' place: the exported file has no marker characters (test).
- [x] A document docx-preview cannot draw falls back to a plain text view with a notice instead of an empty panel.

## Test plan (added by /dev:implement-ticket)
Unit (vitest) for the main fill (markers, special characters, export has none); e2e (Electron, real docx-preview) for pages, highlights, (trống), (thiếu), row switch time, link, fallback.

## Result

PASS. See `.work/phase-1/T-14-report.md`.
