# Phase 0 report: ambiguities, choices and reasons

One entry per ambiguity: where (ticket), what was unclear, the options, the choice and why.

## T-1 Runnable skeleton

1. **electron-vite version.** Spec (2026-10-26) says v5 stable, v6 beta. On 2026-10-28 `latest` is 6.0.0. Chose 6.0.0 (supports Vite 6-8, Node 22.12+); the skeleton builds and the packaged-style smoke test passes. Fallback is 5.0.0.
2. **TypeScript 7.** `latest` is 7.0.2. Chose it: `tsc --noEmit`, Biome, Vitest and electron-vite all work with it in this skeleton.
3. **Sandboxed preload format.** The package is ESM (`"type": "module"`), so electron-vite emitted `preload/index.mjs`; Electron cannot load an ESM preload with `sandbox: true`. Options: turn the sandbox off (rejected: spec requires it), or build the preload as CommonJS. Chose CJS (`index.cjs`) in the config. Verified by the Playwright smoke test (renderer sees no `require` or `process`, `window.sheetstamp.ping` exists).
4. **Electron binary download.** `npm i` did not run Electron's postinstall in this container, so the binary was missing. Ran `node node_modules/electron/install.js`. On CI, `npm ci` runs the postinstall.
5. **Smoke test sandbox flag.** Chromium's setuid sandbox cannot run as root in containers or in some CI runners; the test adds `--no-sandbox` on Linux only. The app's own `sandbox: true` web preference stays on.

## T-3 Word template engine

1. **What "missing value" returns.** Ticket says a tag with no value is an error and "not replaced by an empty string", but not what the output holds. Options: throw (loses the whole row), write an empty string (the library default, silent), or leave the tag visible and list it. Chose the last: `render` returns `{ data, missing }` and writes the original `{{tag}}` text, so the caller can flag the row and a reviewer sees the gap. An explicit empty string is a real value.
2. **Is `{{ten}}` the same field as `{{ ten }}`?** Unspecified. Treated as one field (key is the trimmed NFC name); the library resolves both against the same data name. Loop marks keep their raw text because open and close share a key.
3. **Golden files made from the engine itself.** A golden file written by the code under test proves only stability. Each case also asserts the visible text explicitly (`body` in `tests/fixtures/word/templates.ts`), so a wrong golden cannot hide a wrong output. Regenerate with `UPDATE_GOLDEN=1 npm test`.
4. **Test documents.** No real `.docx` was available, so `tests/fixtures/word/make-docx.ts` builds minimal OOXML with JSZip (checked against the engine only; real Word files are T-4).
5. **Biome and Markdown.** Biome 2.6 reformatted `docs/*.md` on `check --write`. Markdown is now excluded in `biome.json`.

## CI (T-1, found after the first push)

1. **Windows runner checks out CRLF**, which makes Biome's formatter fail on every file and would also break golden-file comparison. Options: `core.autocrlf=false` in the workflow, `.gitattributes`, or Biome `lineEnding: "auto"`. Chose `.gitattributes` (`* text=auto eol=lf`) plus Biome `lineEnding: "lf"`: it fixes every contributor's checkout, not only CI.
2. **Biome checked Markdown** on the Ubuntu runner (docs tables). Markdown is excluded in `biome.json`; its formatting is not enforced.

## T-5 Read CSV and xlsx

1. **How to tell an ID column stored as a number.** The ticket says "ID-like numeric columns" without a rule. Options: (a) any all-digit numeric column of 9+ digits, (b) a header keyword list, (c) both. (a) flags quantities and amounts; (b) alone misses unusual headers. Chose both: the column must come from numeric spreadsheet cells, hold only digits, and have an ID-like header (CCCD, CMND, điện thoại, SĐT, MST, BHXH, số tài khoản, mã NV…; matched without diacritics). CSV text is never flagged because its zeros are already kept. The user can always pad any column by hand.
2. **Dates without a format.** exceljs returns a JS Date; a date cell with no format shows as `yyyy-mm-dd`. Dates are converted to an Excel serial first so `ssf` applies the cell's own format (`dd/mm/yyyy` gives `26/10/2026`).
3. **`.txt` files.** Not accepted, because the spec says `.csv` and `.xlsx` only (an early draft also took `.txt`; removed).
4. **Limits are checked in two places.** The 20 MB limit applies to the file's bytes before parsing; the 50,000-row limit applies after parsing the sheet (a zip of 20 MB can still expand). Streaming large files is deferred until the benchmark (T-10) shows a need.
5. **Windows-1258 test data.** No real file was available. Windows-1258 stores most Vietnamese letters as a base plus a combining mark, and iconv-lite cannot encode composed text (it writes `?`). `tests/fixtures/data/make-data.ts` has a small encoder that follows the real code page rules, so tests use realistic bytes. Real files from HR staff are still wanted (T-4 covers Word only; add CSV samples to that request).
6. **Blank and repeated headers** are renamed `Cột n` and `Tên (2)`, so every column can be mapped; spec did not say.
