# T-5: Read csv xlsx

**Type:** task
**Parent:** E-0
**Requirements:** R0.7, R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R14.5
**Blocked by:** T-1
**Status:** in-review
**New infrastructure:** papaparse, exceljs 4.4 (read-only), ssf, iconv-lite or TextDecoder
**Files:** src/main/data, tests/fixtures/data
**Proof:** `npm test` passes the data-reading fixtures: UTF-8 with and without BOM, Windows-1258, `00000` ID columns, `.xlsx` with several sheets, a renamed `.xls`.
**Step:** close
**Base:**
**Baseline:**

**What to build:** Read a `.csv` or `.xlsx` file into the table model of the first five rows plus a background scan. Encoding order: BOM, strict UTF-8, Windows-1258, with an override; no encoding detector (decision of 2026-10-28). Delimiters are detected; all text is NFC. For `.xlsx`, format cells with `cell.numFmt` through `ssf` (dates converted to a serial first) because exceljs `cell.text` ignores formats; offer per-column zero padding. `.xls` is rejected by extension and by file signature. Files over 20 MB or 50,000 rows are refused with a message.

- [x] Encoding fixtures decode to the same NFC text.
- [x] A `00000` formatted column shows `01234`; a date column shows its display format.
- [x] A renamed `.xls` is rejected with the message asking to re-save.
- [x] Warnings list empty cells and mixed types per column; ID-like numeric columns trigger the zero-padding offer.
- [x] The limit refuses a file above 20 MB or 50,000 rows and loads a 4,000-row file in under 1 s.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: read CSV and xlsx into a table with the spec's encoding, delimiter, leading-zero and size rules.
Proof: `npm test` all green (data: 32 tests); lint and typecheck clean; 4,000 rows load in under 1 s for CSV and xlsx (asserted).
Verdict: VERIFIED on Linux; Windows runs in CI.
Decisions: see `.work/phase-0-report.md` (T-5).
Applied: skip: review: typed.
