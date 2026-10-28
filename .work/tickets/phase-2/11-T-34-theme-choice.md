# T-34: Theme choice

**Type:** feature
**Parent:** E-2
**Requirements:** R10.1, R10.6, R12.3
**Blocked by:** None (can start immediately)
**Status:** ready
**New infrastructure:** none
**Files:** src/main/storage, src/main/ipc, src/shared/ipc, src/renderer/pages/settings, src/renderer/styles.css, src/renderer/lib, tests/e2e
**Proof:** `npm run test:e2e` opens Cài đặt, picks Tối and sees `data-theme="dark"` on `<html>`, restarts the app and finds it still dark, picks Theo hệ thống and the page follows the emulated OS scheme live; a unit test checks the contrast ratio of every status colour in both themes.
**Step:**
**Base:**
**Baseline:**

**What to build:** Cài đặt gets the theme choice (Sáng, Tối, Theo hệ thống; default Theo hệ thống). The choice is saved in the local settings file, applied before the first paint (no flash), and follows the operating system live when set to system. It affects only the app interface. The contrast of text and every status colour (green, yellow, red, grey) is checked against WCAG AA in both themes by a test that reads the tokens.

- [ ] The three choices work; the saved choice is applied before the window shows its content.
- [ ] With Theo hệ thống the interface follows an OS change without a restart.
- [ ] The choice is stored in the settings file next to the other choices and a corrupt file falls back to the default.
- [ ] A test computes the contrast ratio of each status colour on its background in light and dark and fails below 4.5:1 for text.
- [ ] The image editor canvas and the generated files do not depend on the theme.

## Test plan (added by /dev:implement-ticket)

## Result
