# T-33 report: Home export of image templates

| Ambiguity | Options | Choice and reason |
|---|---|---|
| What "remembered" means for the format | One global choice, or per template | Global `Choices.imageFormat: "png" \| "jpg" \| null`. `null` (never chosen) = the background's own format (PNG to PNG, JPEG to JPG); once the user picks, that pick is preselected for every image template. Per template would need a template field and a migration of templates.json. |
| Choices migration | Bump schema version with a migration, or tolerate a missing key | Tolerant read: `isChoices` accepts a missing/null key, `getChoices` fills the default, writes stay atomic. A version bump is shared by all four files and would make an older app call the file "newer". Tests: old file loads, unknown value is corrupt, chosen value survives reopen. |
| JPG quality | - | 90 (constant in session.ts), never shown. |
| Extension and name rules | - | `extensionOf(template, format)` gives ".png" / ".jpg" / ".docx"; the same planner (`planFileNames`, `maxNameLength`) counts it in the 260-char budget, the live example comes from main with the chosen format, so the page never builds names. |
| Estimate | Render in the export pool, or in the existing image worker | Existing single image worker, new job `sample` (first 2 rows, chosen format, rows that fail are left out); total = mean bytes x row count. Shown as "Ước tính khoảng X MB (tính từ vài dòng đầu, ...)"; "Chưa ước tính được" if no row could be drawn. Time is not estimated (only the static PNG-slower-and-larger note). T-24 asked for time too; not done, see below. |
| Pre-flight blockers | Fail every row, or refuse | Refuse. `#image()` in the session checks layout (no boxes / unreadable), background (`checkImage`), fonts (`imageService().listFonts()`, which rescans first). Step 4 shows one danger message and disables the button; `export:start` re-checks and returns `no-boxes`, `bad-template` or `font-missing` (+ `fonts`). Several fonts: one message listing them. On window focus a blocked step re-asks main, so the block lifts after installing the font. |
| Fonts in the export workers | - | `GenerateInit` image gets optional `fonts` (same folders as the image worker); the worker rescans at start. Needed in the e2e build (test font only) and for a font installed after the app started. |
| Row codes | - | `bad-background` is now passed through (was folded into `render-failed`) and added to `RowErrorCode` and the batch's known codes. `font-missing`, `text-too-long` already passed. |
| Word-only `invalid-value` check | Keep for images | Not applied to images (`buildRows(..., checkXml=false)`): a control character is no corrupt-file risk there. |
| Network blocked check (T-35 open item) | skip or do | Done, cheap: `tests/e2e/offline.spec.ts` launches with `--host-resolver-rules=MAP * ~NOTFOUND --proxy-server=http://127.0.0.1:9`, exports an image ZIP, and a `webRequest` hook records zero http(s)/ws(s) requests (control: a `net.fetch` from main is seen). Limit: Node-level sockets in main would not be seen. |

Not done: estimate does not show time; no image-specific hint on the done page for `text-too-long` (the report holds codes only as before); packaged-app self-test not run (CI only; the `GenerateInit` image shape only gained an optional field).

## Benchmark (M3), `npm run bench` extended: kinds word,image,jpg,png; default output now `.work/proof/phase-2-benchmark.md` (Phase 0 files untouched)
4 cores, Node 22, 4,000 rows, 1600x1000 gradient PNG background, 4 boxes, Liberation Sans, 2 runs per size, warm-up not reported, real `runBatch` + `WorkerPool`:

| Kind | Pool | Median s | ZIP MB | Lag p99 ms | Peak RSS MB |
|---|---|---|---|---|---|
| JPG q90 | 3 (default, cores-1) | 37.9 | 221 | 16 | 722 |
| JPG q90 | 4 | 31.8 | 221 | 17 | 781 |
| PNG | 3 | 88.2 | 375 | 16 | 713 |
| PNG | 4 | 71.0 | 375 | 16 | 767 |

(PNG pool 4: ZIP 375 MB.) Both under the provisional 120 s at 1.6 MP; PNG is 2.3x slower than JPG here (T-24 saw 3-10x on photo backgrounds, so a photo PNG run will be slower than this gradient). Main-thread lag p99 stays at 16-17 ms, max 38-51 ms: no UI freeze. M3 can be restated as: 4,000 rows of 1.6 MP in about 40 s (JPG) and 90 s (PNG) on 4 cores; larger backgrounds per T-24 (about 170 s at 6 MP JPG).

## Evidence
- `tests/e2e/export-images.spec.ts` (4 tests): PNG default and example `.png`, size line labelled as estimate, JPG switch and remembered across restart, ZIP of 3 PNG files named from the pattern (row 4 `W`x40 under overflow "error"), report `row,error_code\r\n4,text-too-long\r\n`, no temp files; JPG ZIP has `.jpg` names and JPEG magic; missing font blocks with one inline message and disabled button; cancel on 4,000 PNG rows leaves nothing.
- Unit: `image-session.test.ts`, `generate-job.test.ts`, `image-job.test.ts`, `tests/storage/storage.test.ts`.
- Full e2e run: 58 passed, 1 failed (`security.spec.ts` dropped-file, the known parallel flake from T-30; passes alone, 3 files rerun 11/11).
