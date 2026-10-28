# T-18: Template library edit

**Type:** feature
**Parent:** E-1
**Requirements:** R8.3, R8.6
**Blocked by:** T-17
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/templates, src/main/templates, tests/e2e
**Proof:** `npm run test:e2e` replaces a template's file with a version that renames one tag and adds one, then checks the flags and that the mapping profile is kept.
**Step:**
**Base:**
**Baseline:**

**What to build:** Editing a Word template: change name, group, note, filename pattern and tag labels; replace the source file keeping the mapping profile (tags that no longer exist are flagged, new tags appear as unmatched); and the Manage groups dialog (rename, delete moves its templates to "Chưa phân nhóm").

- [ ] Replacing the file keeps the mapping profile; removed tags are flagged and new tags appear as unmatched.
- [ ] Name, group, note, pattern and labels can be edited and are saved.
- [ ] Manage groups renames and deletes; deleting a group moves its templates to Chưa phân nhóm.
- [ ] A failed replace (unreadable file) leaves the template unchanged and says why.

## Test plan (added by /dev:implement-ticket)

## Result
