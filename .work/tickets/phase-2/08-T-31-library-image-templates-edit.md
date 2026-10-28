# T-31: Library: edit image templates

**Type:** feature
**Parent:** E-2
**Requirements:** R8.3, R4.5
**Blocked by:** T-30
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/pages/templates, src/main/templates, src/shared/ipc/templates.ts, tests/e2e
**Proof:** `npm run test:e2e` edits an image template's name, group and note, reopens its boxes in the editor, then replaces the background with a smaller image and sees the boxes that fall outside it flagged while the others keep their position.
**Step:**
**Base:**
**Baseline:**

**What to build:** Update for image templates: edit name, group, note and filename pattern; "Sửa ảnh" reopens the editor with the saved boxes; replace the background image keeping the layout, flagging boxes that no longer fit inside the new image and keeping fields that still exist. The replacement is committed like the Word one (new copy, commit the record, then delete the old copy). Opening the template for edit shows the missing-font message from T-30 when it applies.

- [ ] Name, group, note and pattern can be edited; duplicate-name warning works as in create.
- [ ] Replacing the image keeps boxes and mapping, and lists boxes outside the new image before saving.
- [ ] The old stored copy is deleted only after the record is committed; a failure leaves the old image in place.
- [ ] Editing the layout of a template used in an unfinished Home flow does not break the flow (the mapping step re-reads it).
- [ ] The Tài liệu edit path is unchanged.

## Test plan (added by /dev:implement-ticket)

## Result
