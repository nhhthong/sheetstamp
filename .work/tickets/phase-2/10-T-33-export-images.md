# T-33: Home: export images

**Type:** feature
**Parent:** E-2
**Requirements:** R4.8, R4.4, R9.5, R6.4, R6.5, R11.1
**Blocked by:** T-32
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/pages/home, src/main/export-session, src/main/export, src/worker, src/shared/ipc/export.ts, tests/e2e
**Proof:** `npm run test:e2e` runs the whole flow with an image template and 4 rows (one with a text too long under "report an error"): the ZIP on disk holds 3 PNG files with the names from the pattern, the error report names row 4 with code only, and cancelling mid-way leaves nothing.
**Step:**
**Base:**
**Baseline:**

**What to build:** Step 4 and the run for image templates: choose the output format (PNG or JPG; default the format of the background, remembered; JPG quality fixed at a sensible value) with the extension appended to the file name, show the estimated total size (from a rendered sample, an estimate said as such), and run the export through the worker pool with the same progress, cancel, error report and done state as Word. Row-level render failures (`font-missing`, `text-too-long`, `bad-background`) become report codes and do not stop the batch. The packaged self-test already exercises this pipeline.

- [ ] PNG and JPG both export; the file extension matches and the live example shows it.
- [ ] The size line is shown for image templates only and is labelled as an estimate.
- [ ] A failed row is skipped and reported by row number and code only; the rest are exported.
- [ ] Cancel leaves no ZIP, no report and no temporary file, as for Word.
- [ ] 4,000 rows on 4 cores stay within the provisional 120 s with no UI freeze (extend `npm run bench` if needed) and the result is recorded for M3.
- [ ] The whole flow passes on Windows and Ubuntu in CI.

## Test plan (added by /dev:implement-ticket)

## Result
