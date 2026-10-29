# T-28 report: image templates (create, list, delete)

| Ambiguity | Options | Choice and reason |
|---|---|---|
| Dialog: extend `NewTemplateDialog` or new one | Add a `kind` prop, or a separate component | Separate `NewImageTemplateDialog`: the Word dialog is reused by the export flow "as is", so it stays untouched. Cost: about 60 lines of group/name/note code are duplicated. |
| Image dimensions | Decode in the image worker, or read headers in main | Headers in main (`src/main/templates/image-file.ts`): PNG IHDR, JPEG first SOF. No decoding, no worker. Limits and the JPEG EOI check follow T-24. |
| JPEG ending | Strict `FF D9` at the last two bytes (T-24 text) | Strict, as decided. A JPEG with trailing padding after EOI would be rejected as cut off; not verified against real camera files. |
| PNG truncation | Not decided in T-24 | Not checked (header only); the engine rejects undecodable PNGs at render time. |
| `tagCount` for an image row | Distinct box fields, or `tags.length` | `tags.length` (0 at creation); T-29 will set `tags` when boxes are saved. |
| Layout shape | - | `src/shared/image-layout`: `{version: 1, boxes: (TextBox & {id})[]}`; `parseImageLayout` returns `{ok, layout}` or `{ok:false, reason: "newer" \| "invalid"}`, never throws. Box fields reuse `parseBox` from `src/shared/ipc/images.ts` (now exported, with `MAX_BOXES`), so render and storage cannot drift. Ids must be unique. Nothing reads the layout on the list path, so a corrupt one cannot stop the list (unit-tested). |
| Limits constants | - | `MAX_BACKGROUND_PIXELS` (25 MP) and `LARGE_BACKGROUND_PIXELS` (4 MP) added next to `MAX_BACKGROUND_BYTES` in `src/shared/ipc/images.ts`; its "provisional" comment updated. |
| Seam for T-29 | - | `continueToImageEditor(templateId)` in `TemplatesPage.tsx`; today it only refreshes the list. The dialog shows "Đã lưu mẫu." itself. |
| Edit button on image rows | - | Hidden until T-29 (the Word edit dialog does not apply). |

Messages: the T-24 texts, each with a fix ("Chọn một ảnh khác.", "Tải lại ảnh gốc hoặc chọn ảnh khác."). `imagesSoon` removed. Tài liệu tab output unchanged; the one assertion in `tests/e2e/templates.spec.ts` that checked the "Sắp có" notice was removed.

Not done: the stored copy is shown to work after the original is moved only in the unit test (original deleted, `readSource` still returns it), not in e2e.
