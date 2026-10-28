# T-22: Home step export options

**Type:** feature
**Parent:** E-1
**Requirements:** R9.5, R5.5, R5.6, R10.3
**Blocked by:** T-21
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/home, src/main/export-settings, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` edits the filename pattern with chips, sees the live example for the first row, ticks "Bỏ dấu", and the folder and options are remembered after a restart.
**Step:**
**Base:**
**Baseline:**

**What to build:** The first half of step 4, Xuất file: the summary lines "Tên file <live example>" and "Lưu vào <folder>" with "Đổi" links; the filename editor (chips for fields in blue and fixed text in grey, each removable, "+ <field>" buttons, "Thêm chữ", the "Bỏ dấu tiếng Việt trong tên file" checkbox off by default and remembered, "Lưu mẫu tên này vào mẫu"); the pattern rules from T-7 shown as inline messages; the operating system folder picker with the last folder remembered. Nothing is exported yet.

- [ ] The live example updates as chips change and shows the sanitized name with its extension.
- [ ] Path characters in fixed text and unknown fields show the message from the rules; the primary button stays disabled.
- [ ] The diacritics checkbox defaults to off and is remembered.
- [ ] "Lưu mẫu tên này vào mẫu" saves the pattern with the template; the default pattern is `{{ten}}`.
- [ ] The folder picker opens at the last folder and the choice is remembered.

## Test plan (added by /dev:implement-ticket)

## Result
