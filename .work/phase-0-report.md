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

### T-2 evidence from CI (run 40720039038, 2026-10-28)

- **Windows (windows-latest, packaged `win-unpacked`)**: `worker_thread` and `utilityProcess` both ran `@napi-rs/canvas` 1.0.11 from inside `app.asar`, drew the four styles, and produced **the same PNG hashes as Linux** (`54e75d918233`, `28adb70d21c0`, `ba1a6eacdb78`, `ed775b7df7f2`): rendering is pixel-identical across the two OSes for the test font. 65 system families were visible.
- **Fonts at runtime (Windows)**: copying a font into `%LOCALAPPDATA%\Microsoft\Windows\Fonts` and calling `loadFontsFromDir` on that folder added the family without a restart (65 to 66 families). Same result on Linux. macOS not tested.
- **Left in the repo on purpose**: `src/worker/canvas-probe.ts`, `src/main/probe.ts`, `--sheetstamp-probe` and `canvas-spike.yml` stay until T-11 replaces them with a packaged self-test that runs the real generator; they guard against a canvas upgrade that crashes Electron (finding 1).

## T-10 Benchmark and worker pool

Evidence: `.work/proof/phase-0-benchmark-deflate.md` (the default, 3 runs per size), `.work/proof/phase-0-benchmark-store.md` (the store experiment), `scripts/bench.mjs`. Machine: 4 vCPU Xeon @ 2.1 GHz, 16.9 GB, Node 22.22. 4,000 rows, no failed row in any run.

1. **Pool size default: "cores" or "cores minus one"?** The spec says sized to the cores; the pool also competes with the main process (ZIP compression) and the window. Measured: with 3 workers Word takes 15.0 s (range 14.9-15.3) and images 41.7 s (40.7-45.1); with 4 workers 13.1 s and 35.5 s. Main-thread event-loop lag stays at 13-17 ms (p99) with every size, so neither blocks the main process. Four workers are about 13-15% faster, but this test cannot see the renderer process, where the window is drawn, and a low-end machine has no spare core. Chose **cores minus one (minimum 1)** as the default: it meets both targets with a wide margin (Word 15 s against 60 s, images 42 s against 120 s) and keeps one core for the UI. This departs from the spec's "sized to the CPU cores"; the size is a parameter, so it can be changed after UI testing (T-10 follow-up: measure the renderer under load).
2. **What limits the speed.** CPU in the workers: 1 to 3 workers speeds up 2.8x (Word) and 2.7x (images), close to the ideal 3x; 4 workers give 3.2x. Rendering and template filling dominate; the main thread (ZIP) is not the limiter. Peak memory 480-815 MB is flat across sizes, so the streaming ZIP holds memory down (no growth with 4,000 files).
3. **Single worker.** 42.4 s for Word and 115.5 s for images: both still inside the targets on this machine, but images only just. A 2-core machine would be near the image limit.
4. **Store instead of deflate in the ZIP?** Tried because every output is already compressed. Result: no measurable gain (Word 15.0 to 14.6 s, images 41.7 to 41.8 s) and the ZIP grew 20-30% (images 190 to 221 MB). Rejected; deflate stays.
5. **Targets.** The provisional targets (60 s Word, 120 s images, UI never blocked) hold on 4 cores. They are kept as the final figures. The runs were repeated three times (two for the store experiment) with one unreported warm-up. Caveat: the machine was not idle while the runs went (I was installing packages and pushing in parallel; load average 4.3 at the start), which can only make the numbers worse, not better.
6. **Test data is synthetic** (a 120-paragraph contract, a 1600x1000 gradient certificate). A real contract with images or a photographic template background will be slower per row; T-4 and the first real templates should repeat the benchmark.

### T-10 follow-up: cache the template analysis (found while testing real-world documents, T-4)

7. **The Word engine parsed the template again for every row.** Adding the tracked-change step (T-4 below) meant a second parse per row, so the template analysis (tracked changes accepted, tags read) is now done once per template object and cached (`WeakMap`). Side effect on speed, same machine, 4,000 rows (`.work/proof/phase-0-benchmark-word-cached.md`): one worker 42.4 s to 27.3 s, three workers 15.0 s to 11.0 s, four workers 13.1 s to 9.9 s. Another reason to keep the analysis out of the per-row path. Image numbers are unchanged.

## T-4 Spike: real templates

The ticket needs 5 anonymized real HR or accounting templates from the owner, which this session cannot get. Searching for public ones (hoatieu.vn, easyhrm.vn, joboko, misa) found pages with download buttons, not direct `.docx` links, and these are commercial sites whose terms do not allow republishing, so none were downloaded or committed. Instead, an "as Word writes it" stand-in was built and run (`prototypes/phase0/spike6-realistic-docx.py` and `spike6-run.mjs`): files made by python-docx, LibreOffice (round trip) and pandoc, plus the raw OOXML patterns Word produces. The stand-in does not replace the owner's real files; it answers "which Word features break the engine" ahead of them.

1. **What counts as "correct" for a real template.** Unspecified. Used: every tag found is replaced, none is left in any part, and the visible text reads as expected.
2. **Results on 12 documents** (library alone): pass for plain python-docx (A), tags split by bold, colour, highlight and size (B), proof marks, bookmarks, language runs and rsids inside a tag (C), hyperlink and field result (D), content control (E), VML text box (F), LibreOffice round trip with headers and footers (J), pandoc (K), first-page header, odd headers and several sections (L), and non-breaking spaces inside the braces (M). Failures: **tracked changes** (G) raised "Can not join text nodes from separate paragraphs", and **tags in footnotes** (I) were silently left in the output.
3. **Fix for tracked changes: accept them before reading.** Options: reject changes, accept them, or report an error. Chose accept (deleted text removed, inserted text kept): it is what the document looks like in Word's default view, and a template with pending edits otherwise fails whole batches. Done once per template in the engine (cached).
4. **Fix for footnotes, endnotes and comments: list their tags as unsupported.** Filling them would need part-level handling the library lacks, and they are rare in HR forms. The tags are now returned by `parseTags` with `kind: "unsupported"`, so the import dialog can warn instead of producing a silently unfilled document.
5. **Threshold.** The decided threshold (all 10 own templates and 4 of 5 real ones) stays. The stand-in passes 10 of 12 before the fixes and 12 of 12 after (G, I handled), which says nothing about the 5 real files; the ticket's first criterion remains open.
6. **Tags with non-breaking spaces** inside the braces are trimmed like ordinary spaces; a non-breaking space in the middle of a name (`{{ho ten}}`) is a different key and is reported as a missing value, not guessed.
