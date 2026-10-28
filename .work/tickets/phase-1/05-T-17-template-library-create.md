# T-17: Template library create

**Type:** feature
**Parent:** E-1
**Requirements:** R8.1, R8.2, R8.4, R8.5, R8.6, R8.7, R8.9, R3.3
**Blocked by:** T-13, T-15, T-16
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/templates, src/main/templates, src/shared/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` creates a Word template from a fixture, sees it in the Tài liệu list with its tag count, then deletes it with the inline confirmation.
**Step:** build
**Base:** fb74317
**Baseline:**

**What to build:** The Mẫu page for Word templates: the list (name, group, source file, tag count, last used, note), the new-template dialog (drop zone for `.docx`, name filled from the file name, group dropdown with "+ Thêm nhóm mới…", optional note, collapsed list of found tags with editable labels from the dictionary), deletion with "Xóa mẫu này? Xóa | Giữ lại" in place, and the default groups. Loop marks and tags found only in footnotes are listed as unsupported with a warning. A duplicate name in the same group shows a warning under the name field.

- [ ] Creating a template from a `.docx` shows "Đã lưu mẫu." and the row with the right tag count.
- [ ] Tags are deduplicated; loop and footnote tags are flagged as unsupported in the dialog.
- [ ] Each tag shows a suggested label and the user can edit it; labels persist.
- [ ] Default groups exist (Hợp đồng, Nghỉ việc, Tài liệu khác); "+ Thêm nhóm mới…" creates one on the spot.
- [ ] Deleting asks in place, then removes the template, its stored copy and its mapping profile.
- [ ] A duplicate name in the same group shows a warning and does not block saving.
- [ ] An empty list shows "Chưa có mẫu tài liệu nào." and a "Tạo mẫu đầu tiên" button.

## Test plan
One e2e spec (tests/e2e/templates.spec.ts): create, restart, delete flow plus refusal of bad files.

## Result
Done. See .work/phase-1/T-17-report.md. biome, typecheck, vitest (181) and playwright (4) green.
