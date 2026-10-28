# T-23: Home step export run

**Type:** feature
**Parent:** E-1
**Requirements:** R9.5, R9.6, R7.5, R6.1, R6.3, R6.4
**Blocked by:** T-22
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/home, src/main/export-session, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` runs the whole flow on generated data (4 rows with one bad), ends with the ZIP on disk with 3 files and a report for row 4, and cancelling mid-way leaves nothing.
**Step:**
**Base:**
**Baseline:**

**What to build:** The second half of step 4 and the end of the flow: the large "Xuất <n> file" button; progress "Đang tạo file… 5/12" with a bar and a text equivalent; "Hủy" saying nothing was saved; the done state ("Đã tạo <n> file", the ZIP path, "Mở thư mục", "<k> dòng bị lỗi" with a link to the CSV report, and "Tạo đợt mới" that clears everything); closing the window during an export asks for confirmation. Generation runs in the worker pool from Phase 0.

- [ ] The whole flow works end to end on generated data: a Windows-1258 CSV and a Word template with split tags, table, header and footer.
- [ ] A bad row does not stop the batch; the done state links to the CSV report with row numbers only.
- [ ] Cancel stops the workers and leaves no ZIP and no temporary file.
- [ ] Progress is announced as text; the bar is not the only signal.
- [ ] Closing the window during an export asks for confirmation; closing at other times does not.
- [ ] "Mở thư mục" opens the folder with the ZIP selected; "Tạo đợt mới" returns to step 1 with everything cleared.

## Test plan (added by /dev:implement-ticket)

## Result
