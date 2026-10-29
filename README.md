# Sheetstamp

Fill Word (`.docx`) templates with rows from a CSV or Excel file, then save every generated file in one ZIP.
Everything runs on your computer: no upload, no account, no telemetry.

Made for HR, accounting and administrative staff who produce contracts, payroll documents, transfer letters or
letters for hundreds of people. The interface is in Vietnamese.

> **Status:** feature complete for the first release (Phase 2); installers build in CI but nothing is published yet.
> Word and image templates both work end to end. See [docs/specification.md](docs/specification.md).

## What it does

- Reads `.csv` and `.xlsx` (several sheets supported). Detects Vietnamese encodings (UTF-8, Windows-1258) and keeps
  leading zeros in ID and phone numbers.
- Word templates: put `{{ten}}` tags in a normal Word file, including tables, headers and footers. Templates are kept
  in a library on your computer.
- Matches columns to tags automatically (ignoring diacritics, with an HR synonym list); you only fix what it cannot
  match, and a preview shows the first rows filled in.
- Names files from a pattern such as `{{ten}}`, avoids duplicates and characters Windows rejects.
- Exports one ZIP with progress and a Cancel button. One bad row never stops the batch; a CSV report lists the rows that failed.

- Image templates: put text boxes on a PNG or JPEG background in an editor (any installed font, shrink / wrap / truncate
  / error when text is too long), export PNG or JPG.
- Light, dark or system theme, and an About page in Settings. No automatic updates and no network calls.

## Platforms

Windows 10/11 (x64) and Ubuntu 22.04/24.04 (x64). macOS builds exist for testing only.

## Develop

Requires Node.js 22.12 or newer (CI uses 24).

```bash
npm ci
npm run dev        # start the app with hot reload
npm run lint       # Biome
npm run typecheck  # TypeScript
npm test           # Vitest
npm run build      # the shipped build; contains no test-only pages
npm run test:e2e   # builds with `npm run build:e2e` first, then runs Playwright (needs a display)
```

Electron needs a display. On Linux without one, run `xvfb-run -a npm run test:e2e`. Where `NODE_OPTIONS` is set (some
containers set `--use-openssl-ca`, which Electron rejects), clear it for that command:
`env -u NODE_OPTIONS xvfb-run -a npm run test:e2e`.

`npm run build:e2e` is `electron-vite build --mode e2e`: it adds the test-only page `out/renderer/preview/demo.html`
(used by `tests/e2e/preview.spec.ts`). To run one spec by hand, run `npm run build:e2e` first, then
`npx playwright test tests/e2e/<spec>`. The plain `npm run build` never produces that page.

Layout: `src/main` (Electron main process and the file work), `src/preload`, `src/renderer` (React UI),
`src/shared` (types and IPC contracts), `src/worker` (heavy work off the main thread). Project notes are in
`docs/` and `GLOSSARY.md`; decisions are in `docs/adr/`.

## Code signing policy

The first Windows release is not signed, so Windows SmartScreen will warn when you run the installer. Each release
publishes `SHA256SUMS.txt` so you can check your download. After the first release the project will apply to
[SignPath](https://signpath.org) for free open-source code signing. The policy page is on the
[download page](https://nhhthong.github.io/sheetstamp/#code-signing-policy).

## License

[MIT](LICENSE). Third-party licenses: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
