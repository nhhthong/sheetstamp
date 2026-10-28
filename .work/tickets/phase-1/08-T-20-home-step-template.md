# T-20: Home step template

**Type:** feature
**Parent:** E-1
**Requirements:** R9.3, R10.3, R9.7
**Blocked by:** T-15, T-17, T-19
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/home, src/main/templates, tests/e2e
**Proof:** `npm run test:e2e` loads data, types "hop dong" in the search, finds "Hợp đồng" templates, and sees the best-matching template first.
**Step:**
**Base:**
**Baseline:**

**What to build:** Step 2, Mẫu: a search box that ignores diacritics (matches name, group and note), group filter chips (the last choice is remembered), and the template list as large buttons (type icon, name, "Khớp x/y trường, <last used>", group label). Order: best column match first, then last used. "Tiếp tục" stays disabled until a template is selected; "+ Mẫu mới" opens the create dialog without leaving the flow; no templates shows "Tạo mẫu đầu tiên".

- [ ] Typing "hop dong" finds templates in the group "Hợp đồng" and by note.
- [ ] With data loaded, templates are ordered by how many fields match columns, then by last use.
- [ ] The selected group chip is remembered for next time.
- [ ] Only one template can be selected per export; the summary line shows its name and group.
- [ ] "+ Mẫu mới" creates a template and returns to the flow with it selectable.

## Test plan (added by /dev:implement-ticket)

## Result

Done. See `.work/phase-1/T-20-report.md`. Proof: `xvfb-run -a npx playwright test` 15 passed (3 in home-template.spec.ts).
