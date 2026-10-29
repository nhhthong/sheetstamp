# T-30 report: image editor inspector and preview

| Ambiguity | Options | Choice and reason |
|---|---|---|
| Sample row for the canvas and preview | Match in the renderer, or in main | Main: new channel `image-editor:sample` (images module, validated) -> `sampleRow(getCurrentTable(), fields)` in `src/main/templates/image-editor.ts`, which uses `matchFields` (the existing exact/synonym/fuzzy rules). The table never leaves main; only the first-row cells of matched fields do. `sampleText(field, labels, sample = {})` returns the cell, else the label, else the key. |
| Segmented controls | Buttons with aria-pressed, or radios | Native radios in a fieldset (arrow keys, disabled, labels for free). |
| Style the family lacks | Hide, or disable | Disabled, with a note; changing family moves to the same style if the family has it, else Thường, else its first real style (`styleAfterFamilyChange`). |
| Missing font | Substitute, or block | One warning listing each family once; the select shows the missing family as a disabled "(không còn trên máy)" option; save is refused in the renderer with the fix text. If `fonts:list` itself fails, no missing-font check is made (fonts = null). |
| Numeric/hex inputs | Controlled value | Draft text; a valid value is applied at once, an invalid one keeps the last valid value, shows the reason, and resets on blur. Font size 1..1000, max lines 1..100 (render accepts up to 10000). |
| Preview | Blob URL, or data URL | Data URL (CSP img-src has data:). Inline section under the editor; RenderError text-too-long/font-missing become the row-level message. |
| Canvas | - | Box height = fontSize*1.25*maxLines; wraps by word only for overflow "wrap" with maxLines > 1. |

Not done: stale preview is not cleared on edits (the user presses "Xem trước" again). No e2e with loaded data (unit test covers sampleRow). "Nâng cao" uses native details.
Flake: in a parallel full run `image-editor.spec.ts` (T-29's) failed once (ETXTBSY on launch in the first parallel run, drag timing in the second?) and `security.spec.ts` dropped-file failed (known); both pass alone.
