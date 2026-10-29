# T-31 report: edit image templates

| Ambiguity | Options | Choice and reason |
|---|---|---|
| Where image edit lives | Extend the Word `EditTemplateDialog`, or a separate dialog | Separate `EditImageTemplateDialog` (same pattern as T-28): the Word dialog and `updateTemplate` stay untouched ("Tài liệu edit path unchanged"). Button "Sửa thông tin" next to "Sửa ảnh" on image rows. |
| IPC | Reuse `templates:update` or new channels | New `templates:image-replace-preview` and `templates:update-image` in the templates module (labels not needed: fields come from boxes). Logic in `src/main/templates/image-edit.ts`. |
| Commit order | - | `storage.updateTemplate(id, patchFor, source)` already does new copy, commit record, delete old copy, in one mutation. A bad image is refused (same `readImage` checks as create) before any write; tested (record and file unchanged). |
| What counts as "outside" | Box origin only, or whole area | Whole box area: width by `fontSize * 1.25 * maxLines` (the canvas height). `partly` = crosses an edge, `outside` = no overlap. `src/shared/image-layout/bounds.ts` (`boxFit`). |
| Confirmation | Separate screen, or inline | The cut boxes are listed as soon as the image is chosen; "Lưu mẫu" then asks inline once ("Vẫn thay ảnh" / "Quay lại") when any box is cut. Nothing is stored before that. |
| Boxes, tags, mapping | - | Never touched by the update patch (layout, tags, mapping equal before and after; unit-tested). |
| Flagging in the editor | Store a flag, or derive | Derived on every render from the bitmap size and the boxes (no stored state, so moving a box back clears it). Banner, "ngoài ảnh" badge in the box list, amber outline on the canvas. |
| Missing-font message on opening | - | Already shown by the editor (T-30); nothing added. |
| Unfinished Home flow | - | The template id and record shape do not change; the update only rewrites name/group/note/pattern/source. Home code not touched (T-32 area), not exercised here. |

Evidence: unit `image-edit.test.ts` (7), `bounds.test.ts` (3); e2e `tests/e2e/templates-image-edit.spec.ts` (2).

Issues / follow-ups
- A box wholly outside the new image is clipped by the canvas stage, so it cannot be dragged back. It can be selected from the list and moved with the arrow keys (Shift = 10 px) or deleted. An X/Y input in the inspector would fix this; not done (no such inputs exist, out of scope).
- The default filename pattern is `{{ten}}`; an image template whose fields do not include `ten` cannot be saved from the edit dialog until the pattern is fixed (same behaviour as Word, inline message).
- JPEG with EXIF rotation: main measures the stored header size, the editor uses the oriented bitmap, so the pre-save list could differ from the editor flags for such files.
- `image-editor.spec.ts` failed once in a parallel run (known flake from T-30 report), passes alone.
