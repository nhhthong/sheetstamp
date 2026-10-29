# T-26 report: fonts and image render over IPC

| Ambiguity | Options | Choice and reason |
|---|---|---|
| Where fonts are rescanned | In the renderer on focus, or in main | Main: `app.on("browser-window-focus")` asks the worker to rescan (only if it was started), and every `fonts:list` call rescans first. The criterion holds for any caller, and a render after a focus sees the new font. |
| Which worker | The export pool, or a new one | A new single-worker pool (`src/worker/image-worker.ts`, started on first use, closed on `will-quit`). Export pools are created per batch and end, so they cannot keep fonts or answer a preview during an export. |
| Canvas never in main | `selftest.ts` imported `createCanvas` statically, so main loaded canvas at every start (found in the built `out/main/index.js`) | Moved to a dynamic import inside the self-test. A production build now has no canvas import in `index.js`. |
| IPC input shape | Stored-template reference or plain data | Plain validated `{ background, boxes, values }`. T-28 can add a reference later; nothing here fixes the persisted shape. The renderer builds `values` (the row, or the labels as sample text). |
| Result shape | Throw, or code | `{ ok: true, png } or { ok: false, code, field? }`. `field` is the tag key; for `font-missing` it is the family (that is what `RenderError` carries). A dead worker still rejects (not a row-level failure). Only the first missing font is reported, so "one message" for several fonts would need `missingFonts` from the caller. |
| Colour validation | Any CSS colour or hex only | Hex only (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`): the spec's colour picker plus hex input. |
| Background size limit | - | `MAX_BACKGROUND_BYTES` = 20 MiB, provisional until spike T-24 sets the limits. Pixel size and EXIF are not checked here (T-24). |
| E2e-only test font | Env var read at runtime, or build-time flag | Build-time: Vite `define` `__SHEETSTAMP_E2E__` from `--mode e2e`. Production bundle has no fixtures path (checked by grep). The e2e main sets `DISABLE_SYSTEM_FONTS_LOAD=1` in the real process before the worker spawns (setting it inside a worker thread would only change its copy of the environment) and skips the system folders on rescan. |
| E2e demo hook | New demo page | None needed: the e2e calls the channels from the app window through the existing bridge. |

Not done on purpose: `src/renderer/lib/ipc.ts` unchanged (`call(listFonts)` and `call(render)` already type correctly); no UI.

Evidence: unit tests `src/shared/ipc/images.test.ts`, `src/worker/image-job.test.ts` (rescan sees a font added later, only real styles, same bytes as `renderImage` and the export generator, removed font gives `font-missing`), `src/main/images/service.test.ts` (incl. the built worker), e2e `tests/e2e/images.spec.ts`. Packaged self-test run on a Linux `--dir` build (made from a copy with a real `node_modules`, because the worktree's symlinked one is not packaged): `self-test OK`, `"previewPng": true`. Windows and macOS packaged runs are CI only.
