# T-38: Show each field's first-row value and let a column serve one field

**Type:** feature
**Parent:** E-3 (#20)
**Requirements:** R2.6, R2.7
**Blocked by:** None (can start immediately)
**Status:** in-review
**Tracker:** #22
**New infrastructure:** none
**Files:** src/renderer/pages/home/mapping-field-row.tsx, src/renderer/pages/home/StepMapping.tsx, src/main/mapping/session.ts, src/main/mapping/profile.ts, src/shared/ipc/mapping.ts, src/renderer/strings/home-mapping.ts, tests/e2e
**Proof:** An e2e spec: pick a column already used by another field; that field becomes empty and shows an alert icon with text; each row shows the chosen column's first-row value.
**Step:** close
**Base:** d4eceac2eb745c4598ab038520ff08af7e8064c5
**Baseline:**

**What to build:** On the mapping step, each row (matched or not) shows the value of its chosen column in the first data row so the user can confirm the match. Choosing a column that another field already uses moves the column to the chosen field; the other field becomes empty and shows a small alert icon with the text "Cột này đã chuyển sang trường khác." until the user picks again. Fixed text and "Để trống" are not limited by this rule. Applies to Word and image templates.

- [x] Every mapping row shows the first-row value of its column (empty text when the cell is empty or no column is chosen).
- [x] Choosing a taken column empties the other field and shows the alert icon; picking again clears the alert.
- [x] The saved mapping profile never holds one column for two fields; automatic matching already follows this.
- [x] The strings exist in English and Vietnamese (`src/renderer/strings`).
- [x] Unit tests cover the rule; an e2e spec covers the alert.

## Test plan (added by /dev:implement-ticket)
Tier light. Unit: `setMappingEntry` moves a taken column and reports `cleared`; `openMapping` hands over the first row. End to end: a new spec in `home-mapping.spec.ts` for the value line and the alert.

## Result
Goal: show each field's first-row value; one column serves one field, with an alert on the field that lost it.

Changed: `MappingView.firstRow` and `SetEntryResult.cleared` (shared IPC); `setMappingEntry` removes the column from other fields in the same storage write; `FieldRow` shows "Dòng đầu: <value>" and the alert; a field that gave up its column joins the list of fields to settle until the user chooses again; vi/en strings.

Proof: `npm test` 467 passed; `npx playwright test` 61 passed; `biome check` and `tsc --noEmit` exit 0. Verdict: VERIFIED.

Decisions: ASK: show the value of the first data row only (not the previewed row) -> yes, as the spec says. A profile saved by an older version may still hold one column for two fields; it is left alone until the user changes a choice.
Follow-ups: none.
Applied: test-plan (inline), skip: review: not run, small UI and one storage rule covered by unit and e2e tests; skip: explore-why: no unfamiliar code.
