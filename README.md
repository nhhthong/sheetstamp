<div align="center">

<img src="site/assets/icon.png" alt="Sheetstamp" width="96" height="96">

# Sheetstamp

**Fill Word and image templates from Excel or CSV. Export hundreds of files in one ZIP.**

Offline desktop app for Windows and Ubuntu. No upload, no account, no telemetry.

[![CI](https://github.com/nhhthong/sheetstamp/actions/workflows/ci.yml/badge.svg)](https://github.com/nhhthong/sheetstamp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Ubuntu-lightgrey)

[Website](https://nhhthong.github.io/sheetstamp/) ·
[Download](https://github.com/nhhthong/sheetstamp/releases/latest) ·
[Tiếng Việt](https://nhhthong.github.io/sheetstamp/vi/) ·
[Specification](docs/specification.md)

</div>

<p align="center">
  <a href="https://nhhthong.github.io/sheetstamp/">
    <img src="site/assets/how-poster.jpg" alt="A CSV file and a contract with {{tags}}: Sheetstamp matches the columns to the tags and fills the contract. Watch the animation on the website." width="860">
  </a>
</p>

## Why Sheetstamp

HR, accounting and administrative teams produce the same document for hundreds of people: contracts, payroll
slips, transfer letters, certificates. Copying values by hand is slow and error-prone, and uploading employee data to
a web service is often not allowed.

Sheetstamp does it on your own computer. Pick a template, pick a spreadsheet, check a preview, export.

## Features

| | |
|---|---|
| **Word templates** | Put `{{name}}` tags in a normal `.docx`, including tables, headers and footers. A tag name can be any text, such as `{{full_name}}`. Templates live in a local library. |
| **Image templates** | Place text boxes on a PNG or JPEG background in a built-in editor and type a name for each field. Any installed font; shrink, wrap, truncate or error when text is too long. Export PNG or JPG. |
| **Spreadsheets** | Reads `.csv` and `.xlsx` (several sheets). Detects Vietnamese encodings (UTF-8, Windows-1258) and keeps leading zeros in IDs and phone numbers. |
| **Column matching** | Matches Word tags to columns by name, ignoring diacritics and small typos; there is no synonym list. Image fields take the columns in order, left to right. Each field shows its value from the first row, a column fills one field, and a preview shows the result for every row. |
| **Safe file names** | Names files from a pattern such as `{{name}}`, avoids duplicates and characters Windows rejects. |
| **One ZIP** | Progress and a Cancel button. One bad row never stops the batch; a CSV report lists the rows that failed. |
| **Private by design** | Works offline. No automatic updates, no network calls, no account. |
| **Themes and language** | Light, dark or system theme. English (default) or Vietnamese interface, chosen in Settings. |

## How it works

```mermaid
flowchart LR
  A["Word or image template<br/>with tags or named fields"] --> C
  B["CSV or Excel file<br/>one row per file"] --> C
  C{"Match<br/>tags to columns"} -->|you check the<br/>first-row values| D["Preview<br/>any row"]
  D --> E["One ZIP<br/>with every file"]
```

<p align="center">
  <a href="https://github.com/nhhthong/sheetstamp/blob/main/site/assets/how.mp4">
    <img src="site/assets/how-contracts.jpg" alt="Four contract templates with tags turning into four finished contracts" width="640">
  </a>
  <br>
  <sub>Watch the 27-second animation, with sound (opens the video on GitHub).</sub>
</p>

<table>
  <tr>
    <td width="33%"><img src="site/assets/app-chon-mau.png" alt="Step 1: choose a template and data"></td>
    <td width="33%"><img src="site/assets/app-ghep-cot.png" alt="Step 2: match columns to tags"></td>
    <td width="33%"><img src="site/assets/app-soan-anh.png" alt="Image template editor"></td>
  </tr>
  <tr>
    <td align="center"><b>1. Data and template</b></td>
    <td align="center"><b>2. Match columns</b></td>
    <td align="center"><b>3. Image editor</b></td>
  </tr>
</table>

Then choose the file-name pattern and export. The result is one ZIP.

### How columns are matched

```mermaid
flowchart TD
  T["Word tag<br/>for example full_name"] --> N{"Same name as a column?<br/>accents are ignored"}
  N -->|yes| M["Matched"]
  N -->|no| F{"Close enough?<br/>small typo or word order"}
  F -->|yes| M
  F -->|no| U["Unmatched: choose a column,<br/>type a fixed text or leave it empty"]
  I["Image field number n"] --> P["Column n of the file,<br/>left to right"] --> M
  M --> V["Each field shows its first-row value;<br/>a column fills one field"]
```

## Install

Download from the [latest release](https://github.com/nhhthong/sheetstamp/releases/latest).

| Platform | File |
|---|---|
| Windows 10/11 (x64) | `Sheetstamp-Setup-x64.exe` |
| Ubuntu 22.04 / 24.04 (x64) | `Sheetstamp-x64.deb` or `Sheetstamp-x64.AppImage` |
| macOS | Coming soon. Builds exist for testing only. |

Each release also publishes `SHA256SUMS.txt`:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing   # Linux
certutil -hashfile Sheetstamp-Setup-x64.exe SHA256   # Windows
```

The Windows installer is not code-signed yet, so Windows SmartScreen may warn when you run it.

```bash
sudo apt install ./Sheetstamp-x64.deb   # Ubuntu
```

## Privacy

- Files are read and written only on your computer.
- The app makes no network calls and sends no telemetry.
- Source code is open under the MIT license, so this can be checked.

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

```mermaid
flowchart LR
  R["Renderer<br/>React UI"] <-->|IPC| P["Preload bridge"] <--> M["Main process<br/>files and storage"] --> W["Workers<br/>fill Word, draw images, build the ZIP"]
```

Electron needs a display. On Linux without one, run `xvfb-run -a npm run test:e2e`. Where `NODE_OPTIONS` is set (some
containers set `--use-openssl-ca`, which Electron rejects), clear it for that command:
`env -u NODE_OPTIONS xvfb-run -a npm run test:e2e`.

`npm run build:e2e` is `electron-vite build --mode e2e`: it adds the test-only page `out/renderer/preview/demo.html`
(used by `tests/e2e/preview.spec.ts`). To run one spec by hand, run `npm run build:e2e` first, then
`npx playwright test tests/e2e/<spec>`. The plain `npm run build` never produces that page.

The website in `site/` is generated: edit `scripts/site/` and run `npm run build:site`.

### Project layout

| Path | Contents |
|---|---|
| `src/main` | Electron main process and the file work |
| `src/preload` | Preload bridge |
| `src/renderer` | React UI (English and Vietnamese) |
| `src/shared` | Types and IPC contracts |
| `src/worker` | Heavy work off the main thread |
| `docs/` | [Specification](docs/specification.md), decisions in `docs/adr/` |
| `GLOSSARY.md` | Project terms |

Built with Electron, React, TypeScript, Vite, Tailwind CSS, Konva, `easy-template-x` and ExcelJS.

## License

[MIT](LICENSE). Third-party licenses: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
