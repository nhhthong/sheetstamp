# T-22: Home step export options

**Type:** feature
**Parent:** E-1
**Requirements:** R9.5, R5.5, R5.6, R10.3
**Blocked by:** T-21
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/home, src/main/export-settings, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` edits the filename pattern with chips, sees the live example for the first row, ticks "Bỏ dấu", and the folder and options are remembered after a restart.
**Step:** close
**Base:** 7304f19 (integration tip, T-13 to T-21)
**Baseline:**

**What to build:** The first half of step 4, Xuất file: the summary lines "Tên file <live example>" and "Lưu vào <folder>" with "Đổi" links; the filename editor (chips for fields in blue and fixed text in grey, each removable, "+ <field>" buttons, "Thêm chữ", the "Bỏ dấu tiếng Việt trong tên file" checkbox off by default and remembered, "Lưu mẫu tên này vào mẫu"); the pattern rules from T-7 shown as inline messages; the operating system folder picker with the last folder remembered. Nothing is exported yet.

- [ ] The live example updates as chips change and shows the sanitized name with its extension.
- [ ] Path characters in fixed text and unknown fields show the message from the rules; the primary button stays disabled.
- [ ] The diacritics checkbox defaults to off and is remembered.
- [ ] "Lưu mẫu tên này vào mẫu" saves the pattern with the template; the default pattern is `{{ten}}`.
- [ ] The folder picker opens at the last folder and the choice is remembered.

## Test plan (added by /dev:implement-ticket)

Tier `full` (user-visible, main-process logic, native dialog). Unit: `src/main/export-session/export-session.test.ts` (rows, ZIP name,
default pattern, example, problems, save, folder), `src/renderer/pages/home/export-pattern.test.ts` (chips round trip). E2E:
`tests/e2e/home-export.spec.ts` (chips, live example, problems, diacritics, save to template, folder, restart).

## Result

Delivered in commit `feat: home step 4 export options (T-22)`. Report: `.work/phase-1/T-22-report.md`.
Proof: `npx vitest run` 22 files 239 passed; `npm run build` then `NODE_OPTIONS= xvfb-run -a npx playwright test` all green
(home-export: 3 passed). Applied: test-plan, design-types. skip: review-impact (new files only, no shared change).
