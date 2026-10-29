# T-34 Theme choice: notes

Ticket file is `11-T-34-theme-choice.md` (the task said 10).

## Choices
1. **Separate `settings.json`, not a field in `choices.json`.** Spec: "local JSON settings file"; ticket: "next to the other choices" (ambiguous). Chose a fourth Collection (`settings.json`, `{theme}`): choices are what the app remembers, settings are what the user sets; a corrupt file loses one, not both (same reason as Phase 1 T-16 "three files"); `Choices` and its tests are untouched. Same atomic write and corrupt fallback (`.bak`, default System, warning). A theme value outside light/dark/system counts as corrupt. File is written on first change only.
2. **Before first paint: `nativeTheme.themeSource` set in main before `createWindow`** (index.ts awaits `applySavedTheme()`, falls back to System if the data folder cannot be opened). prefers-color-scheme is then right for the very first frame, with no preload or additionalArguments plumbing and no inline script (CSP forbids). `data-theme` is set by the renderer after one `settings:get` call; it cannot change the look because the media query already gives the same tokens. Verified: nativeTheme reports `["dark", true]` right after restart. Not verified: a pixel-level first-frame capture (no way to observe it from Playwright).
3. **Playwright pins prefers-color-scheme to light by default**, which hides nativeTheme; the e2e calls `emulateMedia({colorScheme: null})` before reading the real value.
4. System = remove `data-theme`; Sáng/Tối set it (CSS already had the overrides).
5. IPC in own module: `src/shared/ipc/settings.ts` + `src/main/ipc/settings.ts` (`settings:get`, `settings:set-theme`), registered once in each registry list. `settings:get` returns the default when storage cannot open; `set-theme` rejects and the page shows an error.
6. Settings control: native radio inputs (arrow keys free) styled as a segmented control; the selected one also shows a check mark. About left out (T-35).

## Contrast
`src/renderer/styles.test.ts` parses styles.css, computes WCAG ratios for 16 text pairs per theme (text/muted/accent/success/warning/danger on bg and panel, warning and danger on their tinted bg, on-accent on accent and danger) and also checks light/dark token sets match and the prefers-color-scheme block equals `[data-theme="dark"]`. All pairs pass (lowest: light success on panel 4.98, accent on panel 5.37). **No token changed.** Mutation check: a lighter warning made 3 tests fail. Not covered: `--line` borders (non-text, 3:1 rule), disabled state, `bg-accent/10` tint under accent text in export-editor.

## Not applicable
Image editor canvas does not exist yet; generated files are drawn in the worker without CSS, so neither depends on theme.
