# T-21: Home step mapping

**Type:** feature
**Parent:** E-1
**Requirements:** R2.2, R2.3, R2.4, R9.4, R10.3
**Blocked by:** T-14, T-15, T-16, T-19, T-20
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/home, src/main/mapping, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` maps a template whose data has one oddly named column, fixes it by hand, pages through rows in the preview and continues.
**Step:** orient, build, prove
**Base:** d779fd0
**Baseline:**

**What to build:** Step 3, Ghép cột: the heading says how much work is left ("1 trường cần bạn chọn cột." or "Tất cả n trường đã ghép."); each unmatched field is a highlighted row with a marker, its label, a column dropdown ("Chọn cột…", all columns, "Nhập chữ cố định", "Để trống") and the explanation; matched fields hide behind "Xem n trường đã khớp" and can still be changed. The right side shows the sticky preview from T-14 with a pager "‹ Dòng 3/12 ›" that updates immediately. The mapping is saved with the template. "Tiếp tục" is disabled while a field is unresolved (leaving it empty counts as resolved).

- [ ] Unmatched fields are shown first and highlighted; matched ones are collapsed behind a link.
- [ ] Choosing a column, fixed text or empty resolves a field and updates the preview at once.
- [ ] The mapping is saved with the template and reused the next time that template meets matching columns.
- [ ] Changing the data file keeps valid choices and tells the user which fields lost their column.
- [ ] "Tiếp tục" stays disabled until every field is resolved.

## Test plan (added by /dev:implement-ticket)

## Result

Proof: tests/e2e/home-mapping.spec.ts (3 tests) and unit tests. Report: .work/phase-1/T-21-report.md
