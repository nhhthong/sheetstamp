# T-39: Image fields: free-text name, numbering and position matching

**Type:** feature
**Parent:** E-3 (#20)
**Requirements:** R4.11, R4.12, R2.1
**Blocked by:** T-37 (#21)
**Status:** in-review
**Tracker:** #23
**New infrastructure:** none
**Files:** src/renderer/pages/templates/image-editor/FieldPicker.tsx, src/renderer/pages/templates/image-editor/FieldPicker.test.ts, src/renderer/pages/templates/image-editor/fields.ts, src/renderer/pages/templates/image-editor/fields.test.ts, src/renderer/pages/templates/image-editor/ImageEditorPage.tsx, src/renderer/pages/templates/image-editor/BoxInspector.tsx, src/main/templates/image-editor.ts, src/main/mapping/match.ts, src/main/mapping/session.ts, data/hr-dictionary.json, tests/e2e
**Proof:** An e2e spec: add a text box, type "Họ và tên", save; import a CSV whose first column holds names; the mapping step shows field 1 matched to column 1 and the preview draws the name. `npm test` and `npm run test:e2e` pass.
**Step:** close
**Base:** 55e946cf33bccc06ba00a7ec8a27f6b359cec398
**Baseline:**

**What to build:** Adding a text box to an image template asks for the field name as plain text (for example "Họ và tên"), with no suggestions; the name is the field's label and can be edited. Fields are numbered 1, 2, 3 in the order they were added, the number is shown in the editor, and deleting a field renumbers the rest. When data is loaded, field n is matched to the nth column (left to right) as the default; a field without that column is left for the user to match, and the mapping step rules (T-38) apply. The dictionary file `data/hr-dictionary.json` and every renderer use of it are removed.

- [x] The field input accepts any text; no list or suggestion appears; an existing field name is reused rather than duplicated.
- [x] The editor shows each field's number; deleting a field renumbers the others.
- [x] A saved layout with three fields and a CSV with three columns maps field n to column n; with two columns, field 3 is left unmatched.
- [x] Templates saved before this change still open (their stored field keys and labels are kept) and fall back to name matching for fields that already have a saved mapping.
- [x] `data/hr-dictionary.json` is deleted and nothing imports it; the dictionary-based tests are replaced.
- [x] English and Vietnamese strings are updated.

## Test plan (added by /dev:implement-ticket)
Tier light. Unit: positional matching in `reconcile` through `openMapping`, `sampleRow`, `rankTemplates`, field helpers. End to end: the image editor spec (free-text name, number, no list) and the image Home spec (fourth field without a column).

## Result
Goal: image fields are typed as free text, numbered, and matched to the data columns by position; the dictionary file is gone.

Changed: `FieldPicker` became `FieldNameInput` (no suggestions; Enter or leaving the input names the field; a name with no letter or digit is refused); a new text box gets the field "Trường n" with its name selected; the inspector shows "Trường số n" and which column fills it; `matchByPosition` (rule `position`) is used by `reconcile` for image templates, by `sampleRow` and by `rankTemplates`; `data/hr-dictionary.json` deleted.

Proof: `npm test` 457 passed; `npx playwright test` 60 passed; `biome check` and `tsc --noEmit` exit 0. Verdict: VERIFIED.

Decisions: ASK: how does a new box get its name? -> "Trường n" with the text selected, so typing replaces it (no dialog). ASK: do stored templates with dictionary keys still open? -> yes, their stored keys and labels are kept; only the matching rule changed. Deleting a field's last box removes the field, so the others renumber.
Follow-ups: the Home hint for image templates counts position matches ("Khớp 3/4 trường").
Applied: test-plan (inline), skip: review: not run, covered by unit and e2e tests; skip: explore-why: no unfamiliar code.
