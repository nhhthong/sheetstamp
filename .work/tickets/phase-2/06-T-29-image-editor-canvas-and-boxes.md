# T-29: Image editor: canvas and boxes

**Type:** feature
**Parent:** E-2
**Requirements:** R4.2, R4.7, R4.9
**Blocked by:** T-26, T-28
**Status:** done
**New infrastructure:** react-konva and konva in the renderer bundle (licenses added to the notices list)
**Files:** src/renderer/pages/templates/image-editor, src/renderer/pages/templates/TemplatesPage.tsx, src/shared/image-layout, package.json, scripts/third-party-notices.mjs, tests/e2e
**Proof:** `npm run test:e2e` creates an image template, lands in the editor, adds two boxes with "+ Thêm chữ", drags one, deletes the other, saves, reopens and finds the remaining box at the saved position.
**Step:**
**Base:**
**Baseline:**

**What to build:** The image editor sub-page (back link "‹ Mẫu"): the background at its real proportions fitted to the window, text boxes you can add, drag, resize in width and delete, each showing sample text (the first data row when data is loaded, otherwise the field label). react-konva only positions boxes; positions are stored in image pixels, not screen pixels. A box is bound to a field chosen from a dropdown of labels; the field list comes from the HR dictionary plus "+ Trường mới…" for a name typed by the user (see open point O-15 in the planning report). "Lưu mẫu" stores the layout. No undo or redo. The canvas always shows the real image, whatever the theme.

- [ ] Boxes can be added, dragged, resized in width and deleted with the pointer and moved with the arrow keys; the selected box has a visible outline.
- [ ] Positions and sizes are stored in background pixels and survive a window resize and a reopen.
- [ ] A field is chosen per box from the dictionary labels or a new field typed by the user; the number of distinct fields is shown in the library.
- [ ] Sample text is the first data row when data is loaded, otherwise the field label.
- [ ] react-konva and konva work under the CSP; their licenses appear in `THIRD-PARTY-NOTICES.md`.
- [ ] The editor is keyboard usable (select a box, move it, delete it) and announces selection to screen readers.

## Test plan (added by /dev:implement-ticket)

## Result
