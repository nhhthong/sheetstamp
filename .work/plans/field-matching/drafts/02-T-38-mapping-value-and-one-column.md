# T-38: Show each field's first-row value and let a column serve one field

**Type:** feature
**Parent:** E-3 (#20)
**Requirements:** R2.6, R2.7
**Blocked by:** None (can start immediately)
**Status:** ready
**Tracker:** #22
**New infrastructure:** none
**Files:** src/renderer/pages/home/mapping-field-row.tsx, src/renderer/pages/home/StepMapping.tsx, src/main/mapping/session.ts, src/main/mapping/profile.ts, src/shared/ipc/mapping.ts, src/renderer/strings/home-mapping.ts, tests/e2e
**Proof:** An e2e spec: pick a column already used by another field; that field becomes empty and shows an alert icon with text; each row shows the chosen column's first-row value.
**Step:**
**Base:**
**Baseline:**

**What to build:** On the mapping step, each row (matched or not) shows the value of its chosen column in the first data row so the user can confirm the match. Choosing a column that another field already uses moves the column to the chosen field; the other field becomes empty and shows a small alert icon with the text "Cột này đã chuyển sang trường khác." until the user picks again. Fixed text and "Để trống" are not limited by this rule. Applies to Word and image templates.

- [ ] Every mapping row shows the first-row value of its column (empty text when the cell is empty or no column is chosen).
- [ ] Choosing a taken column empties the other field and shows the alert icon; picking again clears the alert.
- [ ] The saved mapping profile never holds one column for two fields; automatic matching already follows this.
- [ ] The strings exist in English and Vietnamese (`src/renderer/strings`).
- [ ] Unit tests cover the rule; an e2e spec covers the alert.

## Test plan (added by /dev:implement-ticket)

## Result
