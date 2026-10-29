# T-32 report: Home image templates in steps 2 and 3

| Ambiguity | Choice and reason |
|---|---|
| Unmapped field in the image | Draws nothing (the engine skips a missing key) and a note under the image lists the unmapped labels ("Chưa ghép nên chưa có chữ trên ảnh: ..."). No "(thiếu)" text is drawn on the image: it would be burnt into what looks like the final output. Empty value draws nothing, no note. |
| No boxes | Refused in main: `mapping:useTemplate` (step 2 shows "Mẫu này chưa có khung chữ. Mở mẫu để thêm.", step stays), also `mapping:open` and `mapping:imageSource`. Unreadable layout has its own message. List hint already says "Chưa có trường nào". |
| Missing font | Shown inline in step 3 from the render result (`font-missing`), with the fix. Only the first missing family is named. Redraws on window focus (main rescans fonts on focus). It does NOT block "Tiếp tục" (ticket: only unresolved fields block); export would fail per row. |
| Data to the preview | New channel `mapping:imageSource` (background + boxes without ids), fetched once; renderer calls the existing `image:render` with values from the shared `rowValues`. |
| One render in flight | `latest-runner.ts`: running plus one waiting slot, newest wins (unit tested). Old image stays until the new one is ready. |
| Ranking and profile | `rankTemplates` and `useTemplate` no longer filter on Word; fields = stored tags. `MappingView.kind` added. Profile is saved by the same code. |
| MappingPreview | `template` prop replaced by a `draw` render prop; Word behaviour unchanged. |

Not done: "+ Mẫu mới" in step 2 still creates Word templates only. Step 4 export of image templates is not part of this ticket.
Flake: `image-editor.spec.ts` failed once in the full parallel run ("Đã lưu mẫu." not seen), passed 2/2 alone (as T-30 noted).
