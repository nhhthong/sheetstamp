# T-29 report: image editor, canvas and boxes

| Ambiguity | Options | Choice and reason |
|---|---|---|
| react-konva under CSP and Electron 45 (risk) | Fall back to plain canvas | Works, no fallback. e2e (`tests/e2e/image-editor.spec.ts`) reads a canvas pixel (0xc8 grey of the background PNG), drags and resizes with the real mouse, and fails on any console CSP message or page error: none. |
| Background under CSP | Add `blob:` to img-src, or data URL, or bitmap | `createImageBitmap(new Blob([bytes]))` in the renderer, drawn by Konva. No URL, so the CSP is unchanged (`img-src 'self' data:`). Bitmap applies EXIF orientation like the engine (T-24), so box pixels match the render. |
| Versions | - | konva 10.8.0 (2026-10-12, 17 days old), react-konva 19.3.2 (peer react ^19.3.0), exact, devDependencies, added to `sheetstamp.bundledDevDependencies`; notices regenerated (+konva, react-konva, react-reconciler, its-fine, @types/react-reconciler, all MIT). |
| IPC | New channels in images module | `image-editor:open` (name, bytes, parsed layout, labels) and `image-editor:save` (layout validated by `parseImageLayout` in main; tags = one per distinct field, label from the sent labels else dictionary suggestion; layout + tags in ONE `updateTemplate`). Logic in `src/main/templates/image-editor.ts` (unit-tested). A newer/corrupt stored layout is refused on open with a message, never overwritten. |
| Field key rule | existing rule? | None for typed labels (main `normalize` joins with spaces). New `fieldKeyOf` in `src/shared/image-layout/field-key.ts` (NFC, strip diacritics via the shared stripper, lowercase, `_`). A typed label whose key matches a dictionary key or known field reuses that label. |
| Dictionary in renderer | via IPC or import | Import `data/hr-dictionary.json` directly (compiled into the bundle, same as main). |
| Sample text | first data row | Data lives in main and needs the column mapping (T-32), so `sampleText(field, labels)` in `image-editor/fields.ts` returns the label now; named seam for T-30/T-32. |
| Keyboard / a11y | Konva has no a11y tree | A visible list of box buttons (Tab reaches them); arrows move 1 px (Shift 10), Delete removes; polite live region announces selection, moves, deletion. Canvas is `role=img`. |
| New box defaults | - | First unused dictionary field, first installed family from `fonts:list` else `sans-serif`, size 5% of image height (min 8), width 60%, `#1a1a1a`, left, 1 line, shrink. |
| Leaving with unsaved changes | - | Inline confirm (Bỏ thay đổi / Ở lại), no `window.confirm`. |
| Row action | - | "Sửa ảnh" on image rows opens the editor; the old e2e assertion "no Sửa button" updated; image creation now lands in the editor, so the two list e2e tests click "‹ Mẫu" first. |

Not done (by design): inspector (T-30), undo/redo, data-row sample text. Box height on canvas is one line (`fontSize*1.25`) since new boxes are 1 line; multi-line display belongs to T-30 with maxLines.
Note: `security.spec.ts` "file dropped outside a drop zone" failed once in a full parallel run and passed twice alone; unrelated to this change, looks load-flaky.
