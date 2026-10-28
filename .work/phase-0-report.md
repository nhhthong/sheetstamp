# Phase 0 report: ambiguities, choices and reasons

One entry per ambiguity: where (ticket), what was unclear, the options, the choice and why.

## T-1 Runnable skeleton

1. **electron-vite version.** Spec (2026-10-26) says v5 stable, v6 beta. On 2026-10-28 `latest` is 6.0.0. Chose 6.0.0 (supports Vite 6-8, Node 22.12+); the skeleton builds and the packaged-style smoke test passes. Fallback is 5.0.0.
2. **TypeScript 7.** `latest` is 7.0.2. Chose it: `tsc --noEmit`, Biome, Vitest and electron-vite all work with it in this skeleton.
3. **Sandboxed preload format.** The package is ESM (`"type": "module"`), so electron-vite emitted `preload/index.mjs`; Electron cannot load an ESM preload with `sandbox: true`. Options: turn the sandbox off (rejected: spec requires it), or build the preload as CommonJS. Chose CJS (`index.cjs`) in the config. Verified by the Playwright smoke test (renderer sees no `require` or `process`, `window.sheetstamp.ping` exists).
4. **Electron binary download.** `npm i` did not run Electron's postinstall in this container, so the binary was missing. Ran `node node_modules/electron/install.js`. On CI, `npm ci` runs the postinstall.
5. **Smoke test sandbox flag.** Chromium's setuid sandbox cannot run as root in containers or in some CI runners; the test adds `--no-sandbox` on Linux only. The app's own `sandbox: true` web preference stays on.

## T-3 Word template engine

1. **What "missing value" returns.** Ticket says a tag with no value is an error and "not replaced by an empty string", but not what the output holds. Options: throw (loses the whole row), write an empty string (the library default, silent), or leave the tag visible and list it. Chose the last: `render` returns `{ data, missing }` and writes the original `{{tag}}` text, so the caller can flag the row and a reviewer sees the gap. An explicit empty string is a real value.
2. **Is `{{ten}}` the same field as `{{ ten }}`?** Unspecified. Treated as one field (key is the trimmed NFC name); the library resolves both against the same data name. Loop marks keep their raw text because open and close share a key.
3. **Golden files made from the engine itself.** A golden file written by the code under test proves only stability. Each case also asserts the visible text explicitly (`body` in `tests/fixtures/word/templates.ts`), so a wrong golden cannot hide a wrong output. Regenerate with `UPDATE_GOLDEN=1 npm test`.
4. **Test documents.** No real `.docx` was available, so `tests/fixtures/word/make-docx.ts` builds minimal OOXML with JSZip (checked against the engine only; real Word files are T-4).
5. **Biome and Markdown.** Biome 2.6 reformatted `docs/*.md` on `check --write`. Markdown is now excluded in `biome.json`.
