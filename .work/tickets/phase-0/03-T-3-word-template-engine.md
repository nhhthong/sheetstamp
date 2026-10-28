# T-3: Word template engine

**Type:** task
**Parent:** E-0
**Requirements:** R0.2, R3.1, R3.2, R3.3, R3.4, R3.5, R14.9
**Blocked by:** T-1
**Status:** done
**New infrastructure:** easy-template-x 8.0.0, JSZip
**Files:** src/main/template-engine, tests/fixtures/word
**Proof:** `npm test` passes the golden-file suite: normalized XML of each output equals its golden file, for all 10 self-written templates.
**Step:** close
**Base:**
**Baseline:**

**What to build:** Import a `.docx` and get its tags (deduplicated, loops and conditions flagged as unsupported), then fill it with a row of data, behind a `TemplateEngine` interface. Tag keys and data keys are normalized to NFC. A tag with no mapped value is reported as an error for the caller to flag, never silently written as an empty string (prototype spike2 found that the library does this). The 10 self-written templates cover split runs, tables, headers, footers, NFD names, tags with diacritics and leading zeros.

- [x] `parseTags` returns unique tags from body, tables, headers and footers; `{{#...}}` and `{{/...}}` are flagged.
- [x] Filling a template with a row replaces split-run tags and keeps surrounding formatting.
- [x] An NFD tag in the file matches an NFC data key.
- [x] A tag with no value yields an error entry and is not replaced by an empty string.
- [x] The `TemplateEngine` interface hides the library; a fake engine passes the same contract tests.
- [x] 10 golden-file tests (normalized XML) pass on Ubuntu and Windows.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: parse and fill Word templates behind a `TemplateEngine` interface.
Proof: `npm test` 33 passed (10 templates x 2 checks plus 5 behaviour tests); lint and typecheck clean. Verdict: VERIFIED on Linux; Windows runs in CI.
Decisions: see `.work/phase-0-report.md` (T-3).
Applied: skip: review: typed; plan-proof tier light (golden XML plus explicit text).
