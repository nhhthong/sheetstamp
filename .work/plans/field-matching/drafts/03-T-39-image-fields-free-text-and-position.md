# T-39: Image fields: free-text name, numbering and position matching

**Type:** feature
**Parent:** E-3 (#20)
**Requirements:** R4.11, R4.12, R2.1
**Blocked by:** T-37 (#21)
**Status:** ready
**Tracker:** #23
**New infrastructure:** none
**Files:** src/renderer/pages/templates/image-editor/FieldPicker.tsx, src/renderer/pages/templates/image-editor/FieldPicker.test.ts, src/renderer/pages/templates/image-editor/fields.ts, src/renderer/pages/templates/image-editor/fields.test.ts, src/renderer/pages/templates/image-editor/ImageEditorPage.tsx, src/renderer/pages/templates/image-editor/BoxInspector.tsx, src/main/templates/image-editor.ts, src/main/mapping/match.ts, src/main/mapping/session.ts, data/hr-dictionary.json, tests/e2e
**Proof:** An e2e spec: add a text box, type "Họ và tên", save; import a CSV whose first column holds names; the mapping step shows field 1 matched to column 1 and the preview draws the name. `npm test` and `npm run test:e2e` pass.
**Step:**
**Base:**
**Baseline:**

**What to build:** Adding a text box to an image template asks for the field name as plain text (for example "Họ và tên"), with no suggestions; the name is the field's label and can be edited. Fields are numbered 1, 2, 3 in the order they were added, the number is shown in the editor, and deleting a field renumbers the rest. When data is loaded, field n is matched to the nth column (left to right) as the default; a field without that column is left for the user to match, and the mapping step rules (T-38) apply. The dictionary file `data/hr-dictionary.json` and every renderer use of it are removed.

- [ ] The field input accepts any text; no list or suggestion appears; an existing field name is reused rather than duplicated.
- [ ] The editor shows each field's number; deleting a field renumbers the others.
- [ ] A saved layout with three fields and a CSV with three columns maps field n to column n; with two columns, field 3 is left unmatched.
- [ ] Templates saved before this change still open (their stored field keys and labels are kept) and fall back to name matching for fields that already have a saved mapping.
- [ ] `data/hr-dictionary.json` is deleted and nothing imports it; the dictionary-based tests are replaced.
- [ ] English and Vietnamese strings are updated.

## Test plan (added by /dev:implement-ticket)

## Result
