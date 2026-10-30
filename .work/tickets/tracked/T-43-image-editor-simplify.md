# T-43: Image editor: remove Advanced and Preview

**Type:** feature
**Parent:** E-4 (#32)
**Requirements:** none
**Blocked by:** None (can start immediately)
**Status:** in-review
**Tracker:** #36
**New infrastructure:** none
**Files:** src/renderer/pages/templates/image-editor/BoxInspector.tsx, ImageEditorPage.tsx, src/renderer/strings/image-editor.ts, docs/specification.md, tests/e2e/image-editor-inspector.spec.ts
**Proof:** `npm test` and the image e2e specs pass; the editor has no "Nâng cao" and no "Xem trước".
**Step:** close
**Base:** 4fdf665

**What to build:** The image editor shows neither the Advanced section nor the Preview.

- [x] No Advanced section and no Preview
- [x] Boxes keep the defaults (1 line, shrink to fit)
- [x] Dead strings and code removed; spec updated

## Result
Goal: simplify the image editor as the tester and owner asked (owner replaced the earlier Q6 "leave them").

Changed: removed the Advanced `<details>` and the Preview section, its state and `showPreview`; removed 14 orphaned strings and the `OVERFLOWS` constant; spec and the inspector e2e updated.

Proof: biome and `tsc` clean; `npm test` 464 passed; `playwright test image` 19 passed. Verdict: VERIFIED.

ASK: what happens to the per-box "maximum lines" and "when text is too long" settings? -> kept in the data and used as stored (default 1 line, shrink); only the UI is gone. Existing templates that set another value keep it.
Follow-ups: the `image:render` IPC channel is no longer called by the editor; left in place (still used by the main process tests), removable later.
Applied: test-plan (light, inline); skip: review: UI removal only.
