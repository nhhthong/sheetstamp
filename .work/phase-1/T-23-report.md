# T-23 report: Home step 4, export run

Base: 5a5ed7f (T-22 on top of 7304f19).

## What exists
- Main: `src/main/export-session/session.ts` (`start`, `cancel`, `settled`, `pathToReveal`), `throttle.ts`, `rows.ts` (`buildRows`); `src/main/ipc/export.ts`
  (`export:start`, `export:cancel`, `export:reveal`, `guardClose`); `src/shared/ipc/export.ts` (channels, `progress` EventChannel, `ExportDone`).
- Renderer: `export-run.ts` (module store), `export-progress.tsx`, `export-done.tsx`, `StepExport.tsx` (wired).
- E2E: `tests/e2e/flow.spec.ts` (whole flow; cancel mid-export), `tests/e2e/home-export.spec.ts` (+3 T-23 tests: close confirmation, no prompt otherwise, step stays active and second start refused).

## Decisions
1. **Mapped but missing column.** Handled in main, `buildRows`, with the preview's `rowValues`: the tag gets no value, the worker fails every row with `missing-tag`, they are reported (done state: "Không tạo được file nào", empty ZIP deleted, report kept). Step 3 normally prevents it. Mapped-but-empty cell is "" and exported.
2. **Per-row missing value.** Table rows are padded, so no cell is ever "absent": a per-row `missing-tag` cannot come from the mapping. Found instead: the Word engine writes XML-invalid control characters (e.g. U+0001) as they are, giving a corrupt .docx (verified). `buildRows` drops such a value, so that row fails `missing-tag` and is reported. The e2e bad row is a cell with U+0001 (CSV byte 0x01). Alternative (strip them silently) is an open item. Engine not changed.
3. **Row numbers** in the report are 1-based data rows (header not counted), same as the pager "Dòng n/N".
4. **Progress throttle.** `throttle(…, 100 ms)` in main: first event at once, then at most one per 100 ms (about 10/s), last state kept by completion result. Unit test: 4,000 events over 10 s give 80 to 110 messages; 4,000 at once give 1. Renderer bar updates from those; the screen-reader announcement is a hidden live region that changes only every 10%.
5. **Invalid pattern.** Primary button visible but disabled with text next to it (T-22); main also refuses `invalid-pattern`.
6. **Close during export.** `app.on("browser-window-created")` attaches `win.on("close")`; if an export runs it does `preventDefault` and shows native `dialog.showMessageBox` ("Ở lại" default, "Hủy và đóng"). Close choice: abort, wait for `settled()` (temp file removed), then close. Otherwise no prompt (tested with a throwing stub).
7. **Data or mapping changing during export.** Cannot: while running, the earlier steps' "Đổi" are bounced back (`flow.complete("export")` at start so they exist, a subscriber calls `flow.reopen("export")`, `flow.invalidate("export")` at the end so later "Tiếp tục" returns here). Also main copies rows, mapping and template bytes at start (unit test changes both mid-run). Asserted in e2e (three "Đổi" clicks, step stays active) and unit.
8. **Single export:** `running` flag set before the first await; second start returns `busy` (unit + e2e through raw IPC).
9. **ZIP name** `<template name> <yyyy-mm-dd>.zip` (local date, sanitized); existing names numbered by `exportZip` (e2e: second run gives "(2)").
10. **Reveal:** the page sends only "zip" or "report"; main shows the path it produced. "Tạo đợt mới": `data:clear` then `flow.reset()`.
11. **Template** marked used after success with at least one file; folder remembered after success.

## Evidence
- biome clean, typecheck clean, vitest 22 files 250 passed; `npm run build` + `NODE_OPTIONS= xvfb-run -a npx playwright test`: 30 passed.
- flow.spec: 12-row Windows-1258 CSV, template with split runs, table, header, footer; "Ngày ký" fixed by hand; pattern by chips; ZIP has 11 UTF-8 names in order (repeat person "(2)"), body/table/header/footer text filled, report is exactly `row,error_code\r\n5,missing-tag\r\n` and has no source data; reveal calls recorded; "Tạo đợt mới" returns to step 1. Cancel with 4,000 rows: a temp file exists while running, after "Hủy" folder is empty, "Chưa lưu gì cả" shown.
- Screenshots viewed in light and dark: editor, exporting, done (`test-results/flow/`).

## Open items
- Control characters could be stripped instead of failing the row.
- A killed app can leave `.sheetstamp-*.tmp` in the folder (not swept).
- Real-world 4,000-row timing not re-measured here (the e2e run of 4,000 rows took about 10 s on 4 cores).

## After merging the review fixes (integration tip moved)
- `createTemplate` takes `source: fileOf(path)` (spec helper and unit test adapted). `data:clear` was removed: "Tạo đợt mới" now uses an own channel `export:resetData`
  (`src/shared/ipc/export.ts`). The close handler is attached with `guardClose(win)` in `src/main/index.ts` beside the navigation guards (the guards are unchanged; this replaces my
  `browser-window-created` hook). Result: biome clean, typecheck clean, vitest 24 files 270 passed, `npm run test:e2e` 36 passed.
