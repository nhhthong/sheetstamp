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

## T-7 Filenames and ZIP

1. **"Reject `/`, `\` and `..`" versus "sanitize invalid characters".** The spec lists both for filenames. Options: reject everything (one odd cell fails a row), or sanitize everything (a typo in the pattern goes unnoticed). Chose a split: in the **pattern** the user types, `/`, `\` and `..` are rejected with a message (`validatePattern`); in **values from the data** they are replaced with `_`. The user is told about their own mistake; a stray `/` in a name cell does not stop the batch.
2. **"Use the row number when a tag is empty".** Unclear whether this is per tag or for the whole name. Chose: when the whole name is empty after sanitizing, the name is the 1-based data row number (`7.docx`). A single empty tag in a longer pattern stays empty.
3. **"Keep the full path within 260 characters".** The final folder is where the user extracts the ZIP, which is unknown. Chose the layout Windows Explorer's "Extract All" produces (`<folder>\<zip name>\<file>`) and budget the file name from the destination folder and ZIP name (`maxNameLength`, minimum 24). Names are cut at grapheme boundaries and keep their extension; a numbered duplicate still fits.
4. **Where the error report goes.** Spec says export a CSV but not where. Chose next to the ZIP as `<zip name>-errors.csv`, not inside it, so the ZIP holds only documents and the UI can link to the report. It is never overwritten.
5. **Existing ZIP name.** Spec silent. The export never overwrites: it writes `name (2).zip`.
6. **Trailing dots and spaces** are removed from names (Windows would drop them silently, causing collisions on extraction). Not in the spec.
7. **Backpressure.** archiver buffers entries unless awaited; each entry is awaited (`entry` event) so memory stays flat for 4,000 files. The 4,000-file memory check is part of T-10.
8. **Not covered by a test:** a real disk-full or permission error (the container runs as root). Cleanup on any non-row error is tested with a stand-in error.

## T-2 Spike: canvas in the packaged app

1. **`@napi-rs/canvas` 1.0.12 and 1.0.13 crash Electron 45 when the module is loaded** (`SIGTRAP`, even in the main process, before any drawing). Versions 1.0.1 to 1.0.11 and 0.1.65 to 0.1.100 load and draw. Options: stay on 1.0.13 and fall back to another library, or pin the last good version. Chose to pin **1.0.11 exactly** (no caret) and to keep the packaged probe in CI (`canvas-spike.yml`), so any upgrade is checked before it lands. Not investigated: the root cause inside the native module; a fallback (skia-canvas, canvaskit-wasm) is not needed while 1.0.11 works, and is the plan if a later Electron breaks it.
2. **Which background process.** Both a `worker_thread` and an Electron `utilityProcess` run the module, in dev and in the packaged app on Linux, and draw identical pixels (same PNG hash for all four styles). Chose **`worker_thread`** for the pool (T-10): no extra process per worker, simple message passing with transferable buffers, and one memory space for caching fonts. `utilityProcess` stays available if a crash in native code must not take the main process down; the cost is a process per worker.
3. **ASAR.** electron-builder unpacks `.node` files by itself and the `asarUnpack` rule `**/*.node` is also set. Worker scripts load from inside `app.asar`; no extra unpacking needed.
4. **Fonts installed while the app runs.** The module does not rescan by itself: a font copied into `~/.local/share/fonts` was not visible until `GlobalFonts.loadFontsFromDir(dir)` was called, after which the family appeared without a restart (re-loading an already loaded folder does not duplicate faces). Options: ask the user to restart, or rescan. Chose **a rescan of the per-user and system font folders when the font list is opened or the window regains focus** (done in T-6). Windows evidence comes from the CI run of `canvas-spike.yml`.
5. **Test-only font.** No fixed font is guaranteed on every runner, so `tests/fixtures/fonts` holds "Sheetstamp Test", a renamed subset of Liberation Sans (OFL), built by a script. It is also the golden-image font for T-6. The ticket's plan said fonts are never bundled in the app; this one lives only in tests and in the spike's `extraResources`, which is removed when the spike code goes.
6. **Environment trap.** The container sets `NODE_OPTIONS=--use-openssl-ca`, which Electron rejects (and a utility process inherits). Run Electron with `env -u NODE_OPTIONS`.

## T-12 Repo and Pages

1. **Where the site lives.** The ticket lists `docs/index.html`, but `docs/` already holds the spec, ADRs and agent notes, and publishing it would expose working documents. Chose a separate `site/` folder deployed by a Pages workflow (`actions/deploy-pages`), so only `site/` is public. Needs one owner action: Settings, Pages, Source = GitHub Actions.
2. **Release file names** are not fixed anywhere yet (T-11 will). The download page needs them now, so it uses `Sheetstamp-Setup-x64.exe`, `Sheetstamp-x64.deb` (the spec's example for the exe, a parallel name for the deb) and `SHA256SUMS.txt`. T-11 must produce exactly these.
3. **Screenshots.** The spec asks for installation instructions "with screenshots", but there is no installer or app to photograph yet. The page has text steps now; screenshots are added at the first release (T-11, manual clean-machine install).
4. **Buttons before a release exists.** Links to `releases/latest/download/...` return 404 until the first release. The page says so in a notice instead of hiding the buttons, so the layout and policy text can be reviewed now.
5. **Electron end-of-support date** (27 April 2027 for Electron 45) is on the page, as the risk table requires. It must be updated whenever the shipped Electron changes.
6. **Undeclared license: `buffers@0.1.1`.** It is a transitive dependency (exceljs, unzipper, binary) with no license field in its package or readme, and its upstream repository could not be read from this environment. The spec says only OSI-approved licenses may ship and SignPath reviews third-party components. The notices file lists it as `UNDECLARED` instead of guessing. Options: (a) confirm the upstream license (it is believed to be MIT/X11), (b) replace the xlsx reader behind an interface. Recommended: (a) first; (b) if it cannot be confirmed before the first release. Added to the spec index as open point O-14.
7. **Not done by Claude, owner only:** two-factor authentication on the account, and enabling Pages. Both are listed in the ticket and cannot be done from here.

## T-6 Image render and fonts

1. **Which faces count as Bold or Normal.** Fonts have weights from 100 to 900, but the UI offers four styles. Chose: weights 300 to 500 are the regular face, 600 and above bold (so Medium and SemiBold families still work); lighter faces (Thin, ExtraLight) are not offered. A style is offered only if a real face maps to it, so the canvas never synthesizes bold or italic (prototype spike4 showed it would).
2. **What "wrap" does past `maxLines`.** The spec lists wrap as an overflow mode but not what happens to a third line when the limit is two. Chose to cut at `maxLines` and end the last line with an ellipsis, so the text never grows outside the box.
3. **How far "shrink" shrinks.** Unspecified. Chose down to 40% of the chosen size, one pixel at a time, then truncate with an ellipsis; text that small would be unreadable and the user should lengthen the box instead. Shrink with `maxLines > 1` wraps first.
4. **`truncate` and `error` with `maxLines > 1`.** Both are single-line modes: truncate cuts one line; error fails the row if one line does not fit.
5. **Line height 1.25** and baseline from the font's own ascent, to leave room for stacked Vietnamese marks (risk table asks for sufficient spacing). Checked by eye on the golden images (all four styles, centered wrap, right-aligned shrink).
6. **Missing font.** `renderImage` throws `font-missing` (never substitutes); `missingFonts(template)` lets the UI show the single message once when the template is opened or exported.
7. **Preview equals export** is guaranteed by having one render function (`renderImage`) and a determinism test (same input, same bytes), not by comparing two code paths.
8. **Golden images** compare with a pixel threshold (0.5% of pixels off by more than 16/255) and only on Linux, the reference OS in the spec. Other OSes still run every behavioural test. A test-only font and `DISABLE_SYSTEM_FONTS_LOAD` keep results machine-independent; setting that variable only works if it is set before the canvas module first loads, so the test sets it in `vi.hoisted`.
9. **Font rescan folders per OS** (`systemFontFolders`): Windows system and per-user folders, macOS three folders, Linux four. The Windows and macOS lists are from documentation, not tested here (Windows evidence comes from the CI probe).
