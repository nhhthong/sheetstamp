# Sheetstamp: spec index

Source: `docs/specification.md`, kept unchanged. Indexed on 2026-10-28; R2.1, R2.5-R2.7, R4.11, R4.12 added 2026-10-29 for epic E-3.
Markers: ✅ decided · ⚠️ open · ❌ blocked by an outside party.
Decision references use the dates and tags in `.work/notes.md` (the `memo` server is not installed, so there are no `D-n` codes).

## Requirements

### R0 Phase 0 checklist (section 9)
| ID | Where in the source | Status |
|---|---|---|
| R0.1 | Repo setup: 2FA, `LICENSE`, `README`, Pages site with code signing policy, third-party notices | ✅ |
| R0.2 | 10 self-written Word templates with mock CSV (split runs, tables, header/footer, NFD, diacritic tags, leading zeros) | ✅ |
| R0.3 | At least 5 real HR/accounting templates | ⚠️ O-1 |
| R0.4 | Skia rendering of Vietnamese diacritics in four styles on three OSes; `@napi-rs/canvas` in the background process and packaged build | ✅ resolved by T-2 |
| R0.5 | Font tests: install while running, uninstalled font, clean machines | ✅ resolved by T-2 |
| R0.6 | ZIP filenames with diacritics in Explorer, Archive Utility, Ubuntu tools | ✅ |
| R0.7 | CSV and `.xlsx` input tests (BOM, Windows-1258, `00000` IDs, renamed `.xls`) | ✅ O-6, O-7 resolved |
| R0.8 | Benchmark 4,000 rows, Word and image, on 4 cores | ✅ |
| R0.9 | Ad hoc-sign macOS build and record the warning | ✅ |
| R0.10 | Clean-machine install: Windows per-user, Ubuntu `.deb` and AppImage, VirusTotal scan | ✅ |
| R0.11 | `releases/latest/download/<fixed-filename>` with a draft-then-publish first release | ✅ |

### R1 Input data (section 5)
| ID | Where in the source | Status |
|---|---|---|
| R1.1 | Accept `.csv` and `.xlsx` with sheet selection | ✅ |
| R1.2 | Reject `.xls` by extension and file signature | ✅ |
| R1.3 | Encoding order: BOM, strict UTF-8, Windows-1258; dropdown with 5-row preview; no TCVN3/VNI | ✅ O-7 resolved |
| R1.4 | Auto delimiter detection, NFC normalization | ✅ |
| R1.5 | Preserve leading zeros: displayed text for `.xlsx`, warning, per-column zero padding | ✅ O-6 resolved |
| R1.6 | First five rows shown; background scan for empty cells and mixed types | ✅ |
| R1.7 | Limit input file size (section 5, security) | ✅ O-8 resolved |

### R2 Mapping
| ID | Where in the source | Status |
|---|---|---|
| R2.1 | Auto match: exact without diacritics, then fuzzy (no synonym dictionary); image fields by position | ✅ |
| R2.2 | List UI: matched fields collapsed, unmatched highlighted first | ✅ |
| R2.3 | Unmatched field: choose column, fixed text, or empty with warning | ✅ |
| R2.4 | Save mapping per template; preview any row | ✅ |
| R2.5 | No HR dictionary: a Word tag's label is the tag with underscores as spaces and a capital first letter (superseded 2026-10-29) | ✅ |
| R2.6 | One column serves one field; choosing a taken column empties the other field and shows an alert icon | ✅ |
| R2.7 | Each mapping row shows the chosen column's value from the first data row | ✅ |

### R3 Word templates
| ID | Where in the source | Status |
|---|---|---|
| R3.1 | Import `.docx`; scan `{{...}}` in body, tables, headers, footers | ✅ O-2 resolved |
| R3.2 | Replace text preserving formatting, including split runs | ✅ O-2 resolved |
| R3.3 | Extract tags on import, dedupe, flag `{{#...}}`/`{{/...}}` as unsupported | ✅ |
| R3.4 | Tags with diacritics supported (risk table) | ✅ O-2 resolved |
| R3.5 | `TemplateEngine` interface so easy-template-x can be replaced | ✅ |
| R3.6 | Edit a template by editing in Word and uploading again | ✅ |

### R4 Image templates
| ID | Where in the source | Status |
|---|---|---|
| R4.1 | Import PNG or JPEG background | ✅ |
| R4.2 | Text box properties: position, font family, size, color, style, alignment, max lines | ✅ |
| R4.3 | Fonts: installed families only, styles offered only if a face exists | ✅ resolved by T-2 |
| R4.4 | Overflow behavior: shrink, wrap, truncate, error for that row | ✅ |
| R4.5 | Missing font: one message, user picks another, no automatic substitution | ✅ |
| R4.6 | Preview uses the exact export render function (Skia); react-konva only positions boxes | ✅ |
| R4.7 | Preview sample: first data row, else tag label | ✅ |
| R4.8 | Export PNG or JPEG | ✅ |
| R4.9 | Image editor sub-page (canvas, inspector, "Nâng cao") | ✅ |
| R4.10 | No synthetic bold or italic until tested | ✅ O-9 resolved |
| R4.11 | Image field: name typed as free text, no suggestions; fields numbered in order; deleting one renumbers | ✅ |
| R4.12 | Image fields are matched to data columns by position, left to right | ✅ |

### R5 Filenames
| ID | Where in the source | Status |
|---|---|---|
| R5.1 | Pattern with tags, extension appended, live example from the first row | ✅ |
| R5.2 | Sanitize invalid characters and reserved names; reject `/`, `\`, `..` | ✅ |
| R5.3 | Keep the full path under 260 characters | ✅ |
| R5.4 | Case-insensitive NFC duplicate detection with sequence number; row number for empty tag | ✅ |
| R5.5 | Optional diacritics removal (checkbox, default off, remembered) | ✅ |
| R5.6 | Pattern saved with the template (default `{{ten}}`), reviewed at Export, can be saved back | ✅ |

### R6 ZIP export
| ID | Where in the source | Status |
|---|---|---|
| R6.1 | Choose destination folder | ✅ |
| R6.2 | Stream to a temp file, rename on completion, delete on cancel or failure | ✅ |
| R6.3 | Progress and Cancel | ✅ |
| R6.4 | One failed row does not stop the batch | ✅ |
| R6.5 | CSV error report: row number and code only; tab-prefix `=+-@` cells | ✅ |
| R6.6 | UTF-8 flag for non-ASCII names in ZIP | ⚠️ O-10 |

### R7 Shell and navigation
| ID | Where in the source | Status |
|---|---|---|
| R7.1 | Three sidebar destinations: Tạo file, Mẫu, Cài đặt | ✅ |
| R7.2 | Sidebar becomes a top bar below about 820 px; minimum window 720×560 | ✅ |
| R7.3 | Toasts for confirmations, announced to screen readers | ✅ |
| R7.4 | Blocking problems shown inline in the step | ✅ |
| R7.5 | Closing during an export asks to confirm | ✅ |

### R8 Template library (screen Mẫu)
| ID | Where in the source | Status |
|---|---|---|
| R8.1 | Create template: import file, name, group, note | ✅ |
| R8.2 | List: name, group, source file, tag count, last used; tabs Tài liệu and Ảnh | ✅ |
| R8.3 | Update: edit fields, replace source file keeping the mapping, flag lost and new tags | ✅ |
| R8.4 | Delete with inline confirmation; removes stored copy and mapping | ✅ |
| R8.5 | Tag labels from HR dictionary, editable, stored with the template | ✅ |
| R8.6 | Groups: three defaults, add on the spot, manage dialog, deletion moves to "Chưa phân nhóm" | ✅ |
| R8.7 | Warn on a duplicate name in the same group | ✅ |
| R8.8 | Keep a copy of each source file in the app's data folder | ✅ |
| R8.9 | New/edit dialog (about 520 px) | ✅ |

### R9 Home export flow (screen Tạo file)
| ID | Where in the source | Status |
|---|---|---|
| R9.1 | Strictly sequential steps; active, done, locked states; "Đổi" keeps valid later choices | ✅ |
| R9.2 | Step 1 Dữ liệu (drop zone, summary, encoding link, Reload) | ✅ |
| R9.3 | Step 2 Mẫu: diacritic-insensitive search, group chips, rank by column match then last used | ✅ |
| R9.4 | Step 3 Ghép cột: mapping list and sticky preview with pager | ✅ |
| R9.5 | Step 4 Xuất file: filename editor, folder, size estimate for images, progress, Cancel, done state, error report link | ✅ |
| R9.6 | Imported data never stored; Home empty after restart | ✅ |
| R9.7 | One template per export | ✅ |

### R10 Settings, theme and storage
| ID | Where in the source | Status |
|---|---|---|
| R10.1 | Theme Light, Dark, System (default System), live updates, UI only | ✅ |
| R10.2 | Settings screen: theme and About (version, MIT, notices, Electron end-of-support, download page, "Kiểm tra bản mới") | ✅ |
| R10.3 | Last output folder, group filter and filename options remembered | ✅ |
| R10.4 | Local JSON files with atomic writes behind `Storage` | ✅ ADR 0001 |
| R10.5 | No telemetry, no automatic updates, no background network calls | ✅ |
| R10.6 | Contrast checked in both themes for every status color | ✅ |

### R11 Quality requirements
| ID | Where in the source | Status |
|---|---|---|
| R11.1 | 4,000 rows without freezing the UI; worker pool sized to CPU cores | ✅ |
| R11.2 | Renderer hardening: no Node access, `contextIsolation`, sandbox, CSP, IPC validation, navigation and `window.open` blocked | ✅ |
| R11.3 | Vietnamese support: NFC, encoding detection, preview confirms diacritics | ✅ |
| R11.4 | OSI-approved licenses only; no bundled fonts or paid modules | ✅ |

### R12 UI specification (section 5.1)
| ID | Where in the source | Status |
|---|---|---|
| R12.1 | Vietnamese copy rules (sentence case, one name per action, errors say how to fix) | ✅ |
| R12.2 | Six design principles | ✅ |
| R12.3 | Visual system: color tokens, typography, spacing, focus ring, reduced motion | ✅ |
| R12.4 | Accessibility: keyboard, labels, status never by color alone, progress text equivalent | ✅ |

### R13 Distribution and signing (section 7)
| ID | Where in the source | Status |
|---|---|---|
| R13.1 | CI builds on three OSes; public releases carry Windows and Ubuntu only | ✅ |
| R13.2 | Windows per-user NSIS installer, first release unsigned, per-release SmartScreen mitigations | ✅ |
| R13.3 | SignPath application after the first release | ❌ O-11 |
| R13.4 | Microsoft Store MSIX backup, only if SignPath rejects | ❌ O-12 |
| R13.5 | Ubuntu `.deb` primary, AppImage secondary | ✅ |
| R13.6 | macOS test builds only; download page says "Coming soon" | ✅ |
| R13.7 | Download page: buttons to `latest/download/<name>`, Vietnamese instructions, `SHA256SUMS.txt` | ✅ |
| R13.8 | Fixed artifact names; draft release, upload, then publish; `0.x` not pre-release | ✅ |
| R13.9 | macOS CI artifact with `retention-days: 1` | ✅ O-13 resolved |
| R13.10 | Code signing policy page with attribution (SignPath requirement) | ✅ |

### R14 Architecture and technology (sections 3 and 4)
| ID | Where in the source | Status |
|---|---|---|
| R14.1 | Four layers: UI, commands, background process for heavy work, local storage | ✅ resolved by T-2 |
| R14.2 | Electron 45, upgraded every 3–4 months; end-of-support date shown | ✅ |
| R14.3 | electron-vite and electron-builder; `.node` files unpacked from ASAR; test the packaged build | ✅ |
| R14.4 | React 19, Tailwind v4, shadcn/ui (Base UI), theme tokens via `nativeTheme` | ✅ |
| R14.5 | Data libraries: papaparse, exceljs (read-only), fuse.js, date-fns, chardet | ✅ O-6, O-7 resolved |
| R14.6 | `@napi-rs/canvas` for drawing; `DISABLE_SYSTEM_FONTS_LOAD` and test font in tests | ✅ resolved by T-2 |
| R14.7 | archiver for streaming ZIP | ✅ |
| R14.8 | Vitest, Playwright, Biome; GitHub Actions on three OSes | ✅ |
| R14.9 | Golden files: normalized XML for Word; pixel threshold on one reference OS for images | ✅ |
| R14.10 | Dependency risk: Renovate or Dependabot, `npm audit` in CI, replaceable abstractions | ✅ |

## Metrics
| ID | Metric | Target | Status |
|---|---|---|---|
| M1 | 4,000 rows to ZIP without UI freeze | no freeze | ✅ |
| M2 | Export time, Word, 4 cores and SSD | ≤ 60 s (provisional) | ⚠️ final after R0.8 |
| M3 | Export time, image, 4 cores and SSD | ≤ 120 s at 1600x1000 (provisional); about 40 s JPG, 90 s PNG measured; 6 MP about 170 s | ✅ restated in `.work/proof/phase-2-benchmark.md` |
| M4 | Cancellation works | supported | ✅ |
| M5 | Every placeholder mapped or flagged | 100% | ✅ |
| M6 | One failed row does not break the batch | holds | ✅ |
| M7 | Works offline | holds | ✅ |
| M8 | Golden-file suite passes on Windows and Ubuntu | passes | ✅ |
| M9 | easy-template-x acceptance | 10/10 own and 4/5 real templates | ✅ |

## Open points
- ⚠️ O-1: Which 5+ real HR/accounting templates will be used for R0.3? Owed by owner since 2026-10-26. A stand-in of 12 realistic documents passes after two fixes (tracked changes, footnotes), see `.work/phase-0-report.md` T-4; the threshold on real files is still open.
- ✅ O-2: easy-template-x handles header/footer, split runs and diacritic tags (prototype spike1, 2026-10-28). Remaining caveats are ticketed in T-3: NFC normalization of keys, missing keys must be flagged, split-run value takes the first run's format.
- ✅ O-3: owner confirmed the phase placement on 2026-10-28 (see `.work/notes.md`, roadmap).
- ✅ O-4: `@napi-rs/canvas` 1.0.11 runs in worker threads and utility processes in the packaged app on Windows and Ubuntu, with identical pixels (CI run 40720039038). Versions 1.0.12 and 1.0.13 crash Electron 45 on load, so the version is pinned. Decision in `.work/notes.md` (2026-10-28, canvas).
- ✅ O-5: styles come from `GlobalFonts.families`; no coverage API (Preview only); a font installed at runtime appears after `loadFontsFromDir` on Linux and Windows (CI). macOS untested.
- ✅ O-6: exceljs `cell.text` ignores number formats; use `cell.numFmt` with `ssf` (spike3).
- ✅ O-7: drop chardet; fixed order BOM, strict UTF-8, Windows-1258 (spike3).
- ✅ O-8: limits 20 MB and 50,000 rows (spike5; revisit after the benchmark).
- ✅ O-9: canvas synthesizes bold and italic; offer only real faces (spike4).
- ⚠️ O-10: UTF-8 flag is set by archiver 8 (spike5). Still open: display on Windows 10/11, macOS and Ubuntu, including an NFD name. Owed by ticket T-7. Needed before R6.6.
- ❌ O-11: Will SignPath approve a solo project? No approved example found; one rejection reported. Owed by SignPath since release 1. Needed before R13.3.
- ❌ O-12: Is Vietnam a supported market for individual Microsoft Store accounts? Owed by Microsoft since 2026-10-26. Needed only if O-11 is rejected (R13.4).
- ✅ O-13: not in practice: one Release run uploaded 566 MB of artifacts to a public repository without error; all artifacts use `retention-days: 1` (ticket T-9). Owner may confirm on the Billing page.

- ⚠️ O-14: Transitive dependency `buffers@0.1.1` (via exceljs) declares no license. Owed by owner, since 2026-10-28. Needed before the first release (R11.4, R13.10). Options in `.work/phase-0-report.md` (T-12).
- ✅ O-15 (superseded 2026-10-29 by R4.11: no dictionary; owner delegated analysed decisions, 2026-10-29): Where do an image template's fields come from (no file to scan)? Recommended: HR dictionary labels plus a typed new field. Owner to confirm. Needed before T-29 (R4.2).
- ✅ O-16 (owner delegated analysed decisions, 2026-10-29): Where is PNG or JPG chosen? Recommended: a choice in Step 4, default the background's format, remembered. Owner to confirm. Needed before T-33 (R4.8).

## Decisions
- notes 2026-10-28 `storage`: local JSON with atomic writes behind `Storage`. ADR: `docs/adr/0001-json-storage.md`.
- notes 2026-10-28 `workflow, git`: default delivery is one branch and pull request per ticket with auto-merge on `ci`; direct push to `main` only when the owner asks in a session.
- notes 2026-10-28 `hr-dictionary`: draft in `data/hr-dictionary.json`, owner reviews, extended after Phase 0.
- notes 2026-10-28 `roadmap`: Phase 0 checks and shell, Phase 1 Word flow, Phase 2 image templates, theme, Settings, packaging and first release, Phase 3+ signing, macOS, deferred items.
- notes 2026-10-28 `ui`: Home steps strictly sequential; minimum window 720×560; section 9 UI assumptions confirmed.
- notes 2026-10-28 `phase0, easy-template-x`: pass threshold 10/10 own and 4/5 real templates.
- notes 2026-10-28 `performance`: provisional targets 60 s Word and 120 s images.
- notes 2026-10-28 `conventions`: electron-vite layout plus `src/worker`, tests beside code, TypeScript strict, Biome, npm, version 0.1.0, English for code and docs.
- notes 2026-10-28 `glossary`: terms in `GLOSSARY.md`.
- notes 2026-10-28 `data, encoding, fonts, input limits, word engine, zip`: results of the Phase 0 prototypes in `prototypes/phase0/`.

## Infrastructure
| Component | First needed by | Status |
|---|---|---|
| GitHub repo, Pages, 2FA, `LICENSE`, CI workflow | R0.1 | ✅ repo and `.github/workflows/ci.yml` exist; Pages and `LICENSE` not yet |
| Branch protection on `main` and auto-merge | first ticket PR | ⚠️ owner sets up on GitHub |
| Electron 45, electron-vite, electron-builder | R0.4 | ✅ chosen, not installed |
| Biome, Vitest, TypeScript | first ticket | ✅ chosen, not installed |
| easy-template-x 8.0.0 | R0.2 | ✅ O-2 resolved |
| papaparse, exceljs, ssf, fuse.js, date-fns (chardet dropped) | R0.7 | ✅ O-6, O-7 resolved |
| `@napi-rs/canvas` | R0.4 | ⚠️ O-4 |
| archiver | R0.6 | ✅ |
| React 19, Tailwind v4, shadcn/ui, react-konva | R9.2 | ✅ |
| Playwright | first UI ticket | ✅ |
| Renovate or Dependabot | after first release | ✅ |
| SignPath | R13.3 | ❌ O-11 |
| Microsoft Store account (conditional) | R13.4 | ❌ O-12 |

## Out of scope
- `.xls` input; TCVN3 and VNI encodings.
- Concatenating columns, value transformations, asking for a value at export time (deferred beyond the MVP).
- Word image insertion, dynamic tables, loops and conditions.
- Mixed styles inside one image text box; undo and redo in the image editor (v1).
- Template export or import between machines; an in-app Word editor.
- Bundled fonts and adding font files in the app; automatic font substitution.
- Storing CSV or Excel data; telemetry; automatic updates; a custom domain.
- A public macOS build until notarization exists.
- SQLite before the MVP ships.
- A "delete all templates and profiles" action.
- Languages other than Vietnamese in the UI.
