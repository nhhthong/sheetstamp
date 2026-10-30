# T-44: Check the new UI by eye (vi and en)

**Type:** task
**Parent:** E-4 (#32)
**Requirements:** none
**Blocked by:** T-40 (#33, PR #31)
**Status:** in-review
**Tracker:** #37
**New infrastructure:** none
**Files:** src/renderer/pages/templates/GroupsDialog.tsx
**Proof:** screenshots of the built app at 1024x768 in vi and en, read one by one.
**Step:** close
**Base:** 563c0ac

**What to build:** Look at the new screens in the real app and fix what looks wrong.

- [x] Sidebar logo, mapping step with the "match in order" button, wide preview and zoom (vi)
- [x] Word template dialog with the tag note open and closed (vi, en)
- [x] Manage groups with the add field (vi, en)
- [x] Defects fixed

## Result
Goal: verify PR #31's UI by eye.

Seen: logo shows beside the name; the "Ghép các trường còn lại theo thứ tự cột" button, pager and zoom row (50–200%) fit at 1024x768; zoom 150% enlarges the page inside the fixed-height box; the example image is readable in the dialog (460 px wide) and the note text wraps cleanly in vi and en.
Defect found: "Thêm nhóm" / "Add group" wrapped onto two lines in Vietnamese. Fixed with `shrink-0 whitespace-nowrap`; rechecked in vi and en.
Not covered: the mapping step in English (selectors in the temp specs were Vietnamese), dark theme.
Verdict: VERIFIED for the screens listed.
Applied: skip: test-plan: a visual check by definition; temp specs deleted.
