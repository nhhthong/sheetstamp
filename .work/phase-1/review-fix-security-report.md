# Review fix: security and build findings (Phase 1)

## 1. BLOCKER: window navigation and IPC origin

- Reproduced: with `isAppUrl` and `isAppFrame` reduced to `startsWith("file://")`, `tests/e2e/security.spec.ts` failed:
  `window.location.href = file:///tmp/.../other.html` moved the window (`page.url()` was the foreign file) and
  `app:info` from the foreign page returned `ok` (expected "Untrusted sender").
- Fix: `src/main/app-url.ts` (new) holds `appPageFile()` and `isAppUrl()`: exact page (scheme, host, path; hash and query
  stripped), `ELECTRON_RENDERER_URL` in dev, `out/renderer/index.html` otherwise. `src/main/index.ts` uses it for
  `will-navigate`, `will-redirect` and `will-frame-navigate`; `src/main/ipc/define.ts` uses it and also requires the top frame.
  `src/renderer/main.tsx` cancels `dragover` (dropEffect none) and `drop` outside a zone.
- Test-only page: `demo.html` may call main only when `SHEETSTAMP_E2E=1` (set by `tests/e2e/preview.spec.ts`; that file
  got a one-line `env` edit). Without it the preview e2e failed because the demo page is rightly refused.
- Proof: `tests/e2e/security.spec.ts` (3 tests) green; navigation to a local file and to https is refused, `window.open`
  returns null and opens no window, a foreign page loaded straight from main gets "Untrusted sender", the app page with
  `#x` still works, a CDP file drop outside a zone: every `dragover` is cancelled and the URL is unchanged. The drop
  zones of `home-data.spec.ts` and `home-template.spec.ts` (new-template dialog) still pass.

## 3. IMPORTANT: zip bomb

- Reproduced: plain JSZip on a 298 KB zip inflated 300 MB, 1.6 s, +634 MB RSS.
- Fix: `src/main/template-engine/zip-limits.ts` `assertSafeZip(bytes)`: parses the End Of Central Directory and the central
  directory, refuses zip64, a part over 50 MB, a total over 100 MB, more than 10 000 entries; then inflates each entry once
  with `maxOutputLength` set to its declared size, so a header that lies cannot pass. Called in the engine `prepare` (which
  every `parseTags` and `render` goes through) and in `plainText` of the preview. `src/main/templates/library.ts` got a
  smallest edit: its catch returns the `ZipLimitError` message (Vietnamese) instead of the generic "not a Word file".
  `MAX_TEMPLATE_BYTES` of the preview is now 20 MB, as the library.
- Proof: `zip-limits.test.ts` and `fill.test.ts` (bomb): a 51 MB part is refused from a few MB of zip in under 200 ms with
  under 10 MB of new buffers; total over 100 MB refused; lying header (claims 1000 or 100 bytes) refused; zip64 locator and
  0xFFFFFFFF sizes refused; engine `parseTags` and `render` and preview `plainText` and `fillForPreview` reject.

## 9. Demo entry in the production build

- `electron.vite.config.ts` adds `preview/demo.html` only with `--mode e2e`. `package.json`: new `build:e2e`
  (`electron-vite build --mode e2e`); `test:e2e` is now `npm run build:e2e && playwright test`. README explains it.
  The CI file is unchanged and still consistent (build, test, then `test:e2e` rebuilds with the e2e mode).
- Proof: `npm run build` then `ls out/renderer` -> `assets  index.html` (no `preview/`); after `build:e2e`:
  `assets  index.html  preview`.

## 12 (part): unused IPC channels

- Removed `mapping:suggest`, `mapping:reconcile`, `mapping:labels`, `data:clear`, `app:ping`, their handlers, request parsers
  (`parseField(s)`, `parseColumns`, `parseProfile`, `SuggestRequest`, `ReconcileRequest`) and the `emptyProfile` helper.
  Kept: `app:info` (smoke test), `matchFields`, `reconcile`, `suggestLabel` (main uses them).
- `tests/e2e/smoke.spec.ts` proves validation now with `data:set-sheet` `{ sheet: 5 }` ("sheet must be a string").
  `ipc.test.ts` tests `app:info`; the channel-parse test of `mapping.test.ts` was deleted with its channels.
- Left: `DataSession.clear()` (and its test in `src/main/data-session`, not mine) is now only used by that test.

## Checks

`npx biome check .` clean; `npm run typecheck` clean; `npx vitest run` 227 passed; `npm run test:e2e` (build:e2e, then the
whole Playwright suite under xvfb) 25 passed.
