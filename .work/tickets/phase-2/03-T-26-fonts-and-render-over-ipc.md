# T-26: Fonts and image render over IPC

**Type:** feature
**Parent:** E-2
**Requirements:** R4.3, R4.5, R4.6, R4.10, R14.6
**Blocked by:** None (can start immediately)
**Status:** ready
**New infrastructure:** none
**Files:** src/shared/ipc/images.ts, src/main/ipc/images.ts, src/main/images, src/worker/render, src/renderer/lib/ipc.ts, tests/e2e
**Proof:** `npm run test:e2e` (built with the test font) lists the family "Sheetstamp Test" with only the styles that have a face, and renders a one-box template with Vietnamese text to a PNG whose size equals the background; unit tests cover a font that is no longer installed.
**Step:**
**Base:**
**Baseline:**

**What to build:** Give the renderer what the image editor and the preview need, without putting native code in the window or the main thread: `fonts:list` (families and the styles they really have, rescanned when the window regains focus and when the list is opened), and `image:render` (one template layout plus one row of values, or the field labels as sample text, returns the PNG the export would draw). Both run the Phase 0 functions in the worker pool, so the preview and the export use the same drawing. A row-level failure comes back as a code (`font-missing`, `text-too-long`, `bad-background`), never as an exception. In the e2e build only, the test font from `tests/fixtures/fonts` is loaded so tests do not depend on the runner's fonts.

- [ ] `fonts:list` returns families grouped by family with only the styles that exist; a style the family lacks is absent, and nothing is synthesised.
- [ ] A font installed while the app runs appears after the window regains focus, without a restart.
- [ ] `image:render` returns the same bytes as the export render function for the same input (compared in a test).
- [ ] A layout that names a font no longer installed returns `font-missing` with the field; the caller can show one message and nothing is substituted.
- [ ] Arguments of both channels are validated in main; an unknown channel or bad argument is refused (same rules as the other channels).
- [ ] The test font is loaded only in the e2e build.

## Test plan (added by /dev:implement-ticket)

## Result
