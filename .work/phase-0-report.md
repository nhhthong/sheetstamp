# Phase 0 report: ambiguities, choices and reasons

One entry per ambiguity: where (ticket), what was unclear, the options, the choice and why.

## T-1 Runnable skeleton

1. **electron-vite version.** Spec (2026-10-26) says v5 stable, v6 beta. On 2026-10-28 `latest` is 6.0.0. Chose 6.0.0 (supports Vite 6-8, Node 22.12+); the skeleton builds and the packaged-style smoke test passes. Fallback is 5.0.0.
2. **TypeScript 7.** `latest` is 7.0.2. Chose it: `tsc --noEmit`, Biome, Vitest and electron-vite all work with it in this skeleton.
3. **Sandboxed preload format.** The package is ESM (`"type": "module"`), so electron-vite emitted `preload/index.mjs`; Electron cannot load an ESM preload with `sandbox: true`. Options: turn the sandbox off (rejected: spec requires it), or build the preload as CommonJS. Chose CJS (`index.cjs`) in the config. Verified by the Playwright smoke test (renderer sees no `require` or `process`, `window.sheetstamp.ping` exists).
4. **Electron binary download.** `npm i` did not run Electron's postinstall in this container, so the binary was missing. Ran `node node_modules/electron/install.js`. On CI, `npm ci` runs the postinstall.
5. **Smoke test sandbox flag.** Chromium's setuid sandbox cannot run as root in containers or in some CI runners; the test adds `--no-sandbox` on Linux only. The app's own `sandbox: true` web preference stays on.
