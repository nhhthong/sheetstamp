# T-7: Filenames and zip

**Type:** task
**Parent:** E-0
**Requirements:** R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R6.1, R6.2, R6.3, R6.4, R6.5
**Blocked by:** T-1
**Status:** ready
**New infrastructure:** archiver 8 (`ZipArchive`)
**Files:** src/main/export, tests/export
**Proof:** `npm test` passes: filename rules (one test per case in the spec), ZIP streaming with cancel and failure cleanup, and the CSV error report.
**Step:**
**Base:**
**Baseline:**

**What to build:** Turn a filename pattern into unique, safe names (sanitize invalid characters and reserved names, reject `/`, `\` and `..`, keep the full path under 260 characters, detect duplicates case-insensitively after NFC and add a sequence number, row number for an empty tag, optional diacritics removal), and write all generated files into one ZIP streamed to a temporary file that is renamed on completion. Cancel and failure delete the temp file. A failing row is recorded and skipped; the error report CSV has only the row number and an error code, and prefixes `=`, `+`, `-`, `@` cells with a tab.

- [ ] Each filename edge case in the spec has a passing test.
- [ ] A cancelled export leaves no temp file and no ZIP.
- [ ] A row that throws does not stop the batch and appears in the report by row number.
- [ ] Report cells that start with `=`, `+`, `-` or `@` begin with a tab.
- [ ] Progress events are emitted per file.

## Test plan (added by /dev:implement-ticket)

## Result
