# T-19: Home step data

**Type:** feature
**Parent:** E-1
**Requirements:** R9.1, R9.2, R9.6, R1.1, R1.3, R1.5, R1.6
**Blocked by:** T-13
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/home, src/main/data-session, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` drops a Windows-1258 CSV, sees the five-row preview and the empty-cell warning, switches the encoding, and the app holds no copy of the data after restart.
**Step:**
**Base:**
**Baseline:**

**What to build:** The Tạo file page with its four-step list (active, done with an "Đổi" link, locked) and step 1, Dữ liệu: the drop zone and file picker (the path comes from the preload bridge, since the sandboxed renderer cannot read it), the loaded state (file name, rows, columns, "Chọn file khác"), the five-row table, warnings for empty cells and numeric ID columns with the zero-padding option, "Chữ hiển thị sai? Đổi bảng mã" with a five-row preview, the sheet selector for `.xlsx`, the `.xls` message and a Reload button. The data stays in the main process memory only.

- [ ] A `.csv` in Windows-1258 shows correct Vietnamese; changing the encoding refreshes the five-row preview.
- [ ] `.xlsx` with several sheets shows a selector; a numeric ID column shows the warning and the pad-with-zeros option.
- [ ] A `.xls` (also a renamed one) shows the message asking to re-save, inline in the step.
- [ ] After restarting the app the page is empty; Reload re-reads the file when it changed on disk.
- [ ] Steps follow the active, done and locked states; "Đổi" reopens a done step.
- [ ] The primary button is always bottom-left of the step.

## Test plan (added by /dev:implement-ticket)

## Result
