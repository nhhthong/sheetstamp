# T-7: Filenames and zip

**Type:** task
**Parent:** E-0
**Requirements:** R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R6.1, R6.2, R6.3, R6.4, R6.5
**Blocked by:** T-1
**Status:** in-review
**New infrastructure:** archiver 8 (`ZipArchive`)
**Files:** src/main/export, tests/export
**Proof:** `npm test` passes: filename rules (one test per case in the spec), ZIP streaming with cancel and failure cleanup, and the CSV error report.
**Step:** close
**Base:**
**Baseline:**

**What to build:** Turn a filename pattern into unique, safe names (sanitize invalid characters and reserved names, reject `/`, `\` and `..`, keep the full path under 260 characters, detect duplicates case-insensitively after NFC and add a sequence number, row number for an empty tag, optional diacritics removal), and write all generated files into one ZIP streamed to a temporary file that is renamed on completion. Cancel and failure delete the temp file. A failing row is recorded and skipped; the error report CSV has only the row number and an error code, and prefixes `=`, `+`, `-`, `@` cells with a tab.

- [x] Each filename edge case in the spec has a passing test.
- [x] A cancelled export leaves no temp file and no ZIP.
- [x] A row that throws does not stop the batch and appears in the report by row number.
- [x] Report cells that start with `=`, `+`, `-` or `@` begin with a tab.
- [x] Progress events are emitted per file.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: unique safe file names and a streamed ZIP with cancel, cleanup, row errors and a CSV report.
Proof: `npm test` all green (export: 40 tests); lint and typecheck clean. Verdict: VERIFIED on Linux; Windows runs in CI.
Decisions: see `.work/phase-0-report.md` (T-7).
Applied: skip: review: typed.
