# T-30: Image editor: inspector and preview

**Type:** feature
**Parent:** E-2
**Requirements:** R4.2, R4.3, R4.4, R4.5, R4.6, R4.10
**Blocked by:** T-29
**Status:** done
**New infrastructure:** none
**Files:** src/renderer/pages/templates/image-editor, src/shared/image-layout, src/renderer/strings, tests/e2e
**Proof:** `npm run test:e2e` selects a box, picks the test font, sets size 48, colour `#c00000`, style Đậm, centre alignment and "Xem trước"; the preview image shows Vietnamese diacritics and its size equals the background; a layout naming a missing font shows one message when opened.
**Step:**
**Base:**
**Baseline:**

**What to build:** The inspector for the selected box: Trường, Font (installed families only, with the note "Chỉ hiện font đã cài trên máy này."), Cỡ chữ, Màu (picker plus hex), Kiểu chữ (Thường, Đậm, Nghiêng, Đậm nghiêng; a style the family lacks is disabled), Căn lề, and a collapsed "Nâng cao" with maximum lines and what to do when the text is too long (shrink, wrap, truncate, report an error for that row), and "Xóa khung chữ này". "Xem trước" shows the bitmap from the same render function as export, so the user can confirm the font draws Vietnamese diacritics. When a saved font is no longer installed, one message appears when the template is opened and the user picks another installed font; nothing is substituted.

- [ ] Every control of the spec's inspector exists, is labelled and works by keyboard; with no box selected it tells the user to select one.
- [ ] A style the family has no face for is disabled, never synthesised.
- [ ] "Xem trước" calls the shared render function (T-26) and shows the result for the first data row, or the labels when no data is loaded.
- [ ] The four overflow behaviours are selectable and a too-long text under "report an error" is shown in the preview as the row-level message.
- [ ] A template whose font is gone shows one message on open; choosing another family clears it; saving with a missing font is refused with the fix next to the message.
- [ ] Colour must be a valid hex; invalid input keeps the last valid value and shows the reason.

## Test plan (added by /dev:implement-ticket)

## Result
