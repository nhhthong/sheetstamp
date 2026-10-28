# T-19 report: Home step 1 (Dữ liệu)

Base: b9d2b69 (the integration tip; the worktree started on the older 1e9d634 and was fast-forwarded).

## What exists

- `src/renderer/pages/home/`: `steps.ts` (the four steps), `flow.ts` (store), `Stepper.tsx` (`Stepper`, `StepFooter`),
  `StepData.tsx` (complete), stubs `StepTemplate.tsx`, `StepMapping.tsx`, `StepExport.tsx`, `HomePage.tsx` (wires them).
- `src/renderer/strings/home.ts`: every Vietnamese string of the Stepper and step 1.
- `src/shared/ipc/data.ts`, `src/main/ipc/data.ts`: channels `data:open-path`, `data:pick-file`, `data:set-encoding`,
  `data:set-sheet`, `data:pad-column`, `data:reload`, `data:clear`, `data:current`.
- `src/main/data-session/` (`DataSession`, `dataSession`, `getCurrentTable()`), unit tests next to it.
- `tests/e2e/home-data.spec.ts`.

## Flow store API (`src/renderer/pages/home/flow.ts`)

- `useFlow()` returns `FlowState` `{ active, done, summaries, results, revision }`; `flow.getState()` reads without subscribing.
- `stepStatus(state, id)` is `"active" | "done" | "locked"`. Active = expanded. Done = finished (stays done while an
  earlier step is reopened, so later choices are kept). Locked = not finished and not active; cannot be opened.
- `flow.complete(step, { summary, result? })`: marks done, stores summary and result, bumps `revision[step]`, and
  activates the first step that is not done (so after "Đổi" on step 1, Tiếp tục lands on the first step still to do).
- `flow.reopen(step)`: the "Đổi" link; only works on a done step.
- `flow.invalidate(step)`: a step's choice stopped being valid; it is no longer done, summary and result dropped.
- `flow.setSummary(step, text)`, `flow.setResult(step, value)`, `flow.result<T>(step)`, `flow.reset()`.
- `revision[step]`: how many times a step was completed. A later step stores the revision of its input when it
  finishes; when `revision.data` differs it knows its own result may be stale (T-21 recomputes the mapping and
  tells the user if fields lost their match, then calls `invalidate` if it must).
- Step 1 result stored: `{ fileName, rows, columns: string[] }`. The table itself is read in main with
  `getCurrentTable()` from `src/main/data-session`.

Each step file exports one component (`StepTemplate`, ...) that renders only its body; `Stepper` draws the marker,
title, state text, summary, "Đổi" link. Put the primary button of a step in `<StepFooter>` (bottom-left).

## Main process

`DataSession` holds `bytes` (raw file, memory only) and the parsed `DataTable`. Operations return
`{ ok: true, snapshot } | { ok: false, error: { code, message? } } | { ok: false, canceled: true }` and never throw; a failed
operation leaves the previous table in place. Nothing is written to disk. The renderer receives a `DataSnapshot`:
file name, row and column counts, column names, first five rows, encoding (CSV), sheets and current sheet (xlsx),
warnings, padded column indexes, `changedOnDisk`. Rows beyond five never leave main.

## Ambiguities, options, choices

1. **Five-row table and warnings from `ColumnScan`/`DataWarning`.** The table is the first five rows of `table.rows`
   (`previewRows`) under the column names. `ColumnScan` is not sent; the three `DataWarning` kinds are sent with the
   column index. Shown: `empty-cells` as "N ô trống ở cột X"; `mixed-types` as a warning line (not in the spec's list but already
   produced by the scan); `id-stored-as-number` as a warning plus a width field and "Thêm số 0 ở đầu". After
   padding, that warning is replaced by a green "Đã thêm số 0 ở đầu cột X" (the scan would still flag it, since the cells are still
   digits, so the session filters it for padded columns). Padding is accepted only for a column the scan flags.
2. **Padding width default.** Options: the longest cell, or a guess from the header. Chose the guess with the longest cell
   as floor: CCCD 12, CMND 9, phone/SĐT 10, MST 10, else the longest cell (`suggestWidth`). The user can edit the number (1 to 64).
3. **Encoding dropdown.** Lists `SELECTABLE_ENCODINGS` (UTF-8, Windows-1258, UTF-16 LE, UTF-16 BE) with Vietnamese labels, only for CSV,
   behind the "Đổi bảng mã" link under the table. Changing it re-decodes the bytes held in main (no second disk read) and the same
   five-row table refreshes in place. TCVN3 and VNI are not offered (not supported by the reader). Re-reading drops any zero padding.
4. **Same file dropped again.** Treated as a fresh open: re-read from disk, encoding and sheet choices reset, padding cleared. Reload,
   in contrast, keeps the encoding and the sheet (falls back to the first sheet if it no longer exists).
5. **File changed on disk.** `data:current` compares size and modified time; the page asks it on mount and on window focus and shows a
   warning "File đã thay đổi trên ổ đĩa. Bấm Đọc lại". The "Đọc lại" button is always there. A missing file gives
   "Không tìm thấy file…" and keeps the old table.
6. **Failed open while a table is loaded** (.xls, too large, bad file): the old table stays and the message shows inline in the step. Messages
   come from `DataError` (Vietnamese); session codes (`file-missing`, `read-failed`, `no-file`, `bad-column`) are worded in `strings/home.ts`.
   Files above 20 MB are refused by `stat` before reading.
7. **Native dialog.** `data:pick-file` calls `dialog.showOpenDialog` in main with filters xlsx and csv (the filter name "Excel, CSV" is the only
   string in main). A `.xls` can still be dropped to get the message.
8. **Reopen after restart.** If the flow says step 1 is done but main has no table (it cannot happen in one run; defensive), step 1 is invalidated.
9. **Stub body text.** Stubs show "Bước này chưa dùng được trong bản hiện tại." when active; tickets replace it.
10. **`Field`/`Select` components** exist in `components/ui/input.tsx` (native select); used as is.

## Findings outside my files

- The Playwright test loader cannot load `exceljs` ("request for './index.js' is from a module not been linked", also with a dynamic import),
  so the spec cannot import `make-data.ts` directly. The spec runs the make-data helpers in a plain Node child process
  (`node --input-type=module -e`, Node 22 strips the types) and writes the fixtures to a temp folder. Later e2e specs needing exceljs
  fixtures can reuse the `generate()` function in `tests/e2e/home-data.spec.ts` (or move it to a shared support file).
- Drop is tested for real: `Input.dispatchDragEvent` over CDP with `files: [path]` produces a File that `webUtils.getPathForFile` resolves.
  The native dialog is answered by overriding `dialog.showOpenDialog` from the test.
- No change to `src/main/data/*`, `vi.ts`, `registry.ts`, `package.json`.

## Evidence

- `npx biome check .`: no errors. `npm run typecheck`: clean. `npx vitest run`: 11 files, 151 tests passed.
- `npm run build`, then `xvfb-run -a npx playwright test`: 6 passed (2 smoke, 4 home-data).
- e2e proves: drop of a Windows-1258 CSV shows correct Vietnamese and "2 ô trống ở cột Email"; the encoding switch changes the preview
  to UTF-8 mojibake and back; the primary button sits left-aligned below the table; done state shows "nhan-vien.csv, 4 dòng, 3 cột" and "Đổi"
  reopens; locked steps have no button; xlsx sheet selector, CCCD warning, padding to `001234567890`; `.xls` and renamed `.xlsx` show the
  re-save message; Reload after a change on disk; after the app closes and restarts the page is empty; the user-data folder and every new entry in
  the temp folder contain none of the data (UTF-8 and UTF-16 byte search for the marker name and a CCCD value) and no `.csv` or `.xlsx` file.
- Screenshots looked at in light and dark (empty, loaded with encoding panel, done): markers carry number or check plus text
  ("Chưa mở", "Đã xong"), focus and tokens come from the shared styles.

## Open items

- The narrow-window layout (below 820 px) was not screenshotted; the step content indents by 48 px on wide screens and by 0 below 820 px.
- Dropping a file while another step is active does nothing (the drop zone exists only in step 1).
- Large-file behaviour (50,000 rows) uses the Phase 0 reader; a progress indicator is only the "Đang đọc file…" text.
