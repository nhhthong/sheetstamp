# T-1: Runnable skeleton

**Type:** task
**Parent:** E-0
**Requirements:** R11.2, R14.2, R14.3, R14.8
**Blocked by:** None (can start immediately)
**Status:** ready
**New infrastructure:** Electron 45, electron-vite 5, electron-builder 26, TypeScript strict, Biome, Vitest, React 19 (bare)
**Files:** package.json, electron.vite.config.ts, biome.json, tsconfig.json, vitest.config.ts, src/main, src/preload, src/renderer, src/shared, .github/workflows/ci.yml
**Proof:** `npm ci && npm run lint && npm run typecheck && npm test && npm run build` exit 0 on Ubuntu and Windows, and the `ci` check passes on a pull request.
**Step:**
**Base:**
**Baseline:**

**What to build:** A runnable skeleton: the app opens one empty window showing its name and version, with the Electron hardening from the spec (no Node in the renderer, `contextIsolation`, sandbox, CSP, navigation and `window.open` blocked, validated IPC with one `ping` command). Toolchain follows the conventions in `CLAUDE.md`. The existing CI workflow starts running the real lint, typecheck and test steps.

- [ ] `npm run dev` opens a window; the renderer cannot reach `require` or `process`.
- [ ] A Vitest test calls the `ping` IPC handler and checks that an invalid argument is rejected.
- [ ] A Playwright smoke test launches the built app and reads the window title.
- [ ] CI runs lint, typecheck, test and build on Ubuntu and Windows; the `ci` check passes.
- [ ] `npm audit` runs in CI (report only).

## Test plan (added by /dev:implement-ticket)

## Result
