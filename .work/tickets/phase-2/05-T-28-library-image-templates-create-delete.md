# T-28: Library: image templates (create, list, delete)

**Type:** feature
**Parent:** E-2
**Requirements:** R4.1, R8.1, R8.2, R8.4, R8.7, R8.8, R8.9
**Blocked by:** T-24
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/pages/templates, src/main/templates, src/main/storage, src/shared/ipc/templates.ts, src/shared/image-layout, tests/e2e
**Proof:** `npm run test:e2e` opens Mẫu, switches to the tab Ảnh, creates a template from a generated PNG, sees it listed with its source file name and "0 trường", deletes it after the inline confirmation, and the stored copy is gone from the data folder.
**Step:**
**Base:**
**Baseline:**

**What to build:** The Ảnh tab of Mẫu works like the Tài liệu tab: "+ Mẫu mới" opens the dialog with a drop zone "Thả ảnh nền (PNG, JPG) vào đây", name (from the file name), group, optional note and the duplicate-name warning. The file is checked by signature, not extension, against the limits decided in T-24, and a copy is kept in the data folder. Saving stores the template with an empty layout and continues to the image editor (the editor itself arrives in T-29; until then it returns to the list with "Đã lưu mẫu."). The list shows name, group, source file, number of fields and last used. Delete removes the record, the stored copy and the mapping after an inline confirmation. The layout (boxes) gets a versioned shape with validation here, stored in the opaque `imageLayout` field that storage already carries.

- [ ] A PNG or JPEG is accepted by signature; a renamed `.gif`, a file over the limits and an unreadable file each show an inline message that says how to fix it.
- [ ] The stored copy is kept in the app's data folder and the template keeps working after the original is moved.
- [ ] The layout has a `version` and a validator; a newer version is refused, a corrupt layout does not stop the list from loading.
- [ ] The tab Ảnh list and empty state ("Chưa có mẫu ảnh nào." with "Tạo mẫu đầu tiên") follow the spec; the Tài liệu tab is unchanged.
- [ ] Limits come from the T-24 decision (`.work/phase-2/T-24-report.md`): PNG/JPEG by signature only, at most 20 MB and 25 megapixels, a JPEG must end with the EOI marker (FF D9) or is rejected as cut off, and above 4 megapixels a warning shows; EXIF orientation needs no handling (the engine applies it).
- [ ] Delete asks inline, removes the record, the stored copy and the mapping profile.
- [ ] A duplicate name in the same group shows a warning under the name field.

## Test plan (added by /dev:implement-ticket)

## Result
