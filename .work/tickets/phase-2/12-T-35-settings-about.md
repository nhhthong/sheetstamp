# T-35: Settings: About

**Type:** feature
**Parent:** E-2
**Requirements:** R10.2, R10.5, R14.2
**Blocked by:** T-34
**Status:** ready
**New infrastructure:** none
**Files:** src/renderer/pages/settings, src/main/ipc/app.ts, src/shared/ipc/app.ts, src/main/index.ts, electron-builder.yml, tests/e2e
**Proof:** `npm run test:e2e` opens Cài đặt > Giới thiệu and sees the version from `package.json`, the MIT licence, the third-party notices text, the Electron end-of-support date, and that "Kiểm tra bản mới" asks the main process to open exactly the download page URL; a test fails if the Electron major in `package.json` has no end-of-support date.
**Step:**
**Base:**
**Baseline:**

**What to build:** The About section of Cài đặt: version, MIT licence, third-party notices (the generated file is packaged with the app and shown in the window), the Electron end-of-support date, a link to the download page and the button "Kiểm tra bản mới", which only opens the download page in the default browser. The app makes no network call itself; opening the browser goes through one allow-listed command that accepts only the fixed URL.

- [ ] Version, licence, notices and the Electron date are shown; the notices file is present in the packaged app.
- [ ] "Kiểm tra bản mới" opens `https://nhhthong.github.io/sheetstamp` through an allow-listed command; any other URL is refused.
- [ ] No background network call exists (a test blocks the network and the app starts and runs).
- [ ] A test fails when Electron's major version changes without an updated end-of-support date.
- [ ] `window.open` and navigation stay blocked in the renderer.

## Test plan (added by /dev:implement-ticket)

## Result
