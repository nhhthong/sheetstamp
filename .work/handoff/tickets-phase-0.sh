#!/usr/bin/env bash
# Creates the Phase 0 epic and its tickets on GitHub. Run once from a clone, logged in with `gh auth login`.
set -euo pipefail
REPO=nhhthong/sheetstamp

for l in epic feature task bug spike in-progress; do gh label create "$l" --repo "$REPO" --force >/dev/null 2>&1 || true; done

dbid() { gh api "repos/$REPO/issues/$1" --jq .id; }
add_sub() { gh api --method POST "repos/$REPO/issues/$1/sub_issues" -F sub_issue_id="$(dbid "$2")" >/dev/null; }
add_blocker() { gh api --method POST "repos/$REPO/issues/$1/dependencies/blocked_by" -F issue_id="$(dbid "$2")" >/dev/null || echo "could not link #$2 as blocker of #$1; set it by hand" >&2; }

tmp=$(mktemp -d)

cat > "$tmp/epic.md" <<'EOF_BODY'
Phase 0: answer the open technical questions and stand up the runnable skeleton, repository and release pipeline.

Requirements: R0.1 to R0.11 in `.work/spec-index.md` (source: `docs/specification.md` section 9).

Exit: every open point O-1, O-4, O-5, O-10 and O-13 is closed with a recorded decision, a packaged app renders Vietnamese images and fills Word templates, and a draft release downloads from the fixed URLs.
EOF_BODY
epic=$(gh issue create --repo "$REPO" --title "Phase 0: verify and scaffold" --body-file "$tmp/epic.md" --label epic | sed 's#.*/##')
echo "epic #$epic"

# T-1
cat > "$tmp/t1.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

A runnable skeleton: the app opens one empty window showing its name and version, with the Electron hardening from the spec (no Node in the renderer, \`contextIsolation\`, sandbox, CSP, navigation and \`window.open\` blocked, validated IPC with one \`ping\` command). Toolchain follows the conventions in \`CLAUDE.md\`. The existing CI workflow starts running the real lint, typecheck and test steps.

## Requirements

R11.2, R14.2, R14.3, R14.8

## New infrastructure

Electron 45, electron-vite 5, electron-builder 26, TypeScript strict, Biome, Vitest, React 19 (bare)

## Files

package.json, electron.vite.config.ts, biome.json, tsconfig.json, vitest.config.ts, src/main, src/preload, src/renderer, src/shared, .github/workflows/ci.yml

## Proof

\`npm ci && npm run lint && npm run typecheck && npm test && npm run build\` exit 0 on Ubuntu and Windows, and the \`ci\` check passes on a pull request.

## Acceptance criteria

- [ ] \`npm run dev\` opens a window; the renderer cannot reach \`require\` or \`process\`.
- [ ] A Vitest test calls the \`ping\` IPC handler and checks that an invalid argument is rejected.
- [ ] A Playwright smoke test launches the built app and reads the window title.
- [ ] CI runs lint, typecheck, test and build on Ubuntu and Windows; the \`ci\` check passes.
- [ ] \`npm audit\` runs in CI (report only).

EOF_BODY
t1=$(gh issue create --repo "$REPO" --title "T-1: Runnable skeleton" --body-file "$tmp/t1.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t1"
echo "T-1 -> #$t1"

# T-2
cat > "$tmp/t2.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Question (open point O-4): does \`@napi-rs/canvas\` run correctly in the background process of the packaged app on Windows 10/11 and Ubuntu 22.04/24.04? Prototype spike4 already showed it draws Vietnamese diacritics in a \`worker_thread\` on Linux with plain Node.

## Requirements

R0.4, R14.1, R14.6

## New infrastructure

none

## Files

none

## Proof

none

## Acceptance criteria

- [ ] A decision is recorded in \`.work/notes.md\` (background process type, how the \`.node\` file is unpacked) with the evidence.
- [ ] Packaged builds on Windows and Ubuntu render the four styles with correct diacritics.
- [ ] The answer on fonts installed at runtime is recorded for each OS.

EOF_BODY
t2=$(gh issue create --repo "$REPO" --title "T-2: Spike canvas packaged" --body-file "$tmp/t2.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t2"
add_blocker "$t2" "$t1"
echo "T-2 -> #$t2"

# T-3
cat > "$tmp/t3.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Import a \`.docx\` and get its tags (deduplicated, loops and conditions flagged as unsupported), then fill it with a row of data, behind a \`TemplateEngine\` interface. Tag keys and data keys are normalized to NFC. A tag with no mapped value is reported as an error for the caller to flag, never silently written as an empty string (prototype spike2 found that the library does this). The 10 self-written templates cover split runs, tables, headers, footers, NFD names, tags with diacritics and leading zeros.

## Requirements

R0.2, R3.1, R3.2, R3.3, R3.4, R3.5, R14.9

## New infrastructure

easy-template-x 8.0.0, JSZip

## Files

src/main/template-engine, tests/fixtures/word

## Proof

\`npm test\` passes the golden-file suite: normalized XML of each output equals its golden file, for all 10 self-written templates.

## Acceptance criteria

- [ ] \`parseTags\` returns unique tags from body, tables, headers and footers; \`{{#...}}\` and \`{{/...}}\` are flagged.
- [ ] Filling a template with a row replaces split-run tags and keeps surrounding formatting.
- [ ] An NFD tag in the file matches an NFC data key.
- [ ] A tag with no value yields an error entry and is not replaced by an empty string.
- [ ] The \`TemplateEngine\` interface hides the library; a fake engine passes the same contract tests.
- [ ] 10 golden-file tests (normalized XML) pass on Ubuntu and Windows.

EOF_BODY
t3=$(gh issue create --repo "$REPO" --title "T-3: Word template engine" --body-file "$tmp/t3.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t3"
add_blocker "$t3" "$t1"
echo "T-3 -> #$t3"

# T-4
cat > "$tmp/t4.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Question (open point O-1): do at least 4 of 5 real HR or accounting templates produce correct output with the engine from T-3? The owner supplies the templates (anonymized). Run each through \`parseTags\` and fill with mock data, then compare with the original in Word. If fewer than 4 pass, add a run-merging preprocessing step before considering another library (the threshold was decided on 2026-10-28). Record the result and the failing patterns.

## Requirements

R0.3

## New infrastructure

none

## Files

none

## Proof

none

## Acceptance criteria

- [ ] Owner has supplied at least 5 real templates (anonymized).
- [ ] Result of each template (pass or failure pattern) is recorded.
- [ ] A decision is recorded: keep the engine, add run merging, or replace it.

EOF_BODY
t4=$(gh issue create --repo "$REPO" --title "T-4: Spike real templates" --body-file "$tmp/t4.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t4"
add_blocker "$t4" "$t3"
echo "T-4 -> #$t4"

# T-5
cat > "$tmp/t5.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Read a \`.csv\` or \`.xlsx\` file into the table model of the first five rows plus a background scan. Encoding order: BOM, strict UTF-8, Windows-1258, with an override; no encoding detector (decision of 2026-10-28). Delimiters are detected; all text is NFC. For \`.xlsx\`, format cells with \`cell.numFmt\` through \`ssf\` (dates converted to a serial first) because exceljs \`cell.text\` ignores formats; offer per-column zero padding. \`.xls\` is rejected by extension and by file signature. Files over 20 MB or 50,000 rows are refused with a message.

## Requirements

R0.7, R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R14.5

## New infrastructure

papaparse, exceljs 4.4 (read-only), ssf, iconv-lite or TextDecoder

## Files

src/main/data, tests/fixtures/data

## Proof

\`npm test\` passes the data-reading fixtures: UTF-8 with and without BOM, Windows-1258, \`00000\` ID columns, \`.xlsx\` with several sheets, a renamed \`.xls\`.

## Acceptance criteria

- [ ] Encoding fixtures decode to the same NFC text.
- [ ] A \`00000\` formatted column shows \`01234\`; a date column shows its display format.
- [ ] A renamed \`.xls\` is rejected with the message asking to re-save.
- [ ] Warnings list empty cells and mixed types per column; ID-like numeric columns trigger the zero-padding offer.
- [ ] The limit refuses a file above 20 MB or 50,000 rows and loads a 4,000-row file in under 1 s.

EOF_BODY
t5=$(gh issue create --repo "$REPO" --title "T-5: Read csv xlsx" --body-file "$tmp/t5.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t5"
add_blocker "$t5" "$t1"
echo "T-5 -> #$t5"

# T-6
cat > "$tmp/t6.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

One render function draws a template's text boxes for a row onto the background image; the preview and the export both call it. A font service lists installed families with the styles that really exist (from \`GlobalFonts.families\`) and offers no style without a face. Overflow modes (shrink, wrap, truncate, error for that row) and a missing-font check that reports once and never substitutes are covered.

## Requirements

R0.5, R4.2, R4.3, R4.4, R4.5, R4.6, R4.8, R4.10

## New infrastructure

@napi-rs/canvas 1.x

## Files

src/worker/render, src/main/fonts, tests/fixtures/image

## Proof

\`npm test\` passes the golden-image suite (pixel threshold, one reference OS) with \`DISABLE_SYSTEM_FONTS_LOAD\` and a test-only font.

## Acceptance criteria

- [ ] Preview and export produce identical pixels for the same row.
- [ ] Only faces that exist are offered; a family with no bold face does not offer Bold.
- [ ] Each overflow mode has a test with a long Vietnamese string.
- [ ] Opening a template whose font is gone returns one message and no automatic substitution.
- [ ] Export to PNG and JPEG works; golden images pass with the test-only font.

EOF_BODY
t6=$(gh issue create --repo "$REPO" --title "T-6: Image render and fonts" --body-file "$tmp/t6.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t6"
add_blocker "$t6" "$t2"
echo "T-6 -> #$t6"

# T-7
cat > "$tmp/t7.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Turn a filename pattern into unique, safe names (sanitize invalid characters and reserved names, reject \`/\`, \`\\\` and \`..\`, keep the full path under 260 characters, detect duplicates case-insensitively after NFC and add a sequence number, row number for an empty tag, optional diacritics removal), and write all generated files into one ZIP streamed to a temporary file that is renamed on completion. Cancel and failure delete the temp file. A failing row is recorded and skipped; the error report CSV has only the row number and an error code, and prefixes \`=\`, \`+\`, \`-\`, \`@\` cells with a tab.

## Requirements

R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R6.1, R6.2, R6.3, R6.4, R6.5

## New infrastructure

archiver 8 (\`ZipArchive\`)

## Files

src/main/export, tests/export

## Proof

\`npm test\` passes: filename rules (one test per case in the spec), ZIP streaming with cancel and failure cleanup, and the CSV error report.

## Acceptance criteria

- [ ] Each filename edge case in the spec has a passing test.
- [ ] A cancelled export leaves no temp file and no ZIP.
- [ ] A row that throws does not stop the batch and appears in the report by row number.
- [ ] Report cells that start with \`=\`, \`+\`, \`-\` or \`@\` begin with a tab.
- [ ] Progress events are emitted per file.

EOF_BODY
t7=$(gh issue create --repo "$REPO" --title "T-7: Filenames and zip" --body-file "$tmp/t7.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t7"
add_blocker "$t7" "$t1"
echo "T-7 -> #$t7"

# T-8
cat > "$tmp/t8.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Question (open point O-10): do non-ASCII filenames, including an NFD name, display correctly when a ZIP from T-7 is opened in Windows 10 Explorer, Windows 11 Explorer, macOS Archive Utility and Ubuntu's archive manager? Prototype spike5 already showed that archiver 8 sets the UTF-8 flag. Record a screenshot or description for each, and the fix if one fails.

## Requirements

R0.6, R6.6

## New infrastructure

none

## Files

none

## Proof

none

## Acceptance criteria

- [ ] A result for each of the four tools is recorded.
- [ ] A fix or a documented workaround exists for any failure.

EOF_BODY
t8=$(gh issue create --repo "$REPO" --title "T-8: Spike zip names on os" --body-file "$tmp/t8.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t8"
add_blocker "$t8" "$t7"
echo "T-8 -> #$t8"

# T-9
cat > "$tmp/t9.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Question (open point O-13): do artifacts of a public repository count toward the 500 MB shared storage limit? After the first CI run that uploads an artifact, read the Billing page and record the answer. Decide the \`retention-days\` for the macOS test artifact.

## Requirements

R13.9

## New infrastructure

none

## Files

none

## Proof

none

## Acceptance criteria

- [ ] The Billing page reading is recorded.
- [ ] \`retention-days\` for macOS artifacts is decided.

EOF_BODY
t9=$(gh issue create --repo "$REPO" --title "T-9: Spike artifact quota" --body-file "$tmp/t9.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t9"
add_blocker "$t9" "$t1"
echo "T-9 -> #$t9"

# T-10
cat > "$tmp/t10.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

Run generation in a worker pool sized to the CPU cores (default), with cancel and progress, for both Word and image output, and measure it. Targets: Word at most 60 s, images at most 120 s, the UI never blocked. Report the result as \`test-benchmark\` asks: what limits it, repeat runs, end-to-end share. Settle the final targets after the measurement.

## Requirements

R0.8, R11.1, R14.1

## New infrastructure

none

## Files

src/worker/pool, src/main/export, tests/bench

## Proof

\`npm run bench\` prints timings for 4,000 Word and 4,000 image rows on a 4-core machine, with event-loop lag measured on the main process.

## Acceptance criteria

- [ ] 4,000 Word rows produce a ZIP and finish within the target, or the measured figure is recorded as the new target.
- [ ] 4,000 image rows likewise.
- [ ] Main-process event-loop lag stays low during the run (measured and recorded).
- [ ] Cancel stops all workers and leaves nothing behind.
- [ ] The result is written to \`.work/notes.md\` with the machine description.

EOF_BODY
t10=$(gh issue create --repo "$REPO" --title "T-10: Benchmark and worker pool" --body-file "$tmp/t10.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t10"
add_blocker "$t10" "$t3"
add_blocker "$t10" "$t6"
add_blocker "$t10" "$t7"
echo "T-10 -> #$t10"

# T-11
cat > "$tmp/t11.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

CI builds installers on Windows and Ubuntu and a macOS ad hoc build kept only as a one-day workflow artifact (decision of T-9). Release assets have fixed names. A release is created as a draft, assets are uploaded, then it is published in one step. Version \`0.x\` is not marked pre-release. The Windows per-user NSIS installer carries publisher and version info, no UPX, and is scanned with VirusTotal. Manual checks: install on clean Windows and Ubuntu 22.04/24.04 (\`.deb\` and AppImage) and record the macOS warning.

## Requirements

R0.9, R0.10, R0.11, R13.1, R13.5, R13.8, R13.9

## New infrastructure

electron-builder targets: NSIS, deb, AppImage, mac dir (ad hoc)

## Files

.github/workflows/release.yml, electron-builder config, scripts/release

## Proof

A tagged draft release holds \`Sheetstamp-Setup-x64.exe\`, the \`.deb\`, the AppImage and \`SHA256SUMS.txt\`; it is then published and \`releases/latest/download/<fixed-filename>\` downloads each file.

## Acceptance criteria

- [ ] Draft release contains all assets with fixed names and \`SHA256SUMS.txt\`.
- [ ] \`releases/latest/download/<fixed-filename>\` works after publishing.
- [ ] Clean-machine installs succeed on Windows (per-user, no admin) and Ubuntu (\`.deb\` and AppImage); results are recorded.
- [ ] VirusTotal scan result and any Defender warning are recorded.
- [ ] The macOS artifact expires after one day and is not attached to the public release; the warning text is recorded.

EOF_BODY
t11=$(gh issue create --repo "$REPO" --title "T-11: Release pipeline" --body-file "$tmp/t11.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t11"
add_blocker "$t11" "$t2"
add_blocker "$t11" "$t9"
echo "T-11 -> #$t11"

# T-12
cat > "$tmp/t12.md" <<EOF_BODY
## Parent

Phase 0 epic (#${epic})

## What to build

The public face of the project: \`LICENSE\` (MIT), a feature-focused \`README\`, a Vietnamese download page on GitHub Pages with buttons pointing at \`releases/latest/download/<fixed-filename>\`, installation instructions, a "Code signing policy" section, a third-party notices file, and the macOS "Coming soon" note.

## Requirements

R0.1, R13.7, R13.10

## New infrastructure

none

## Files

LICENSE, README.md, THIRD-PARTY-NOTICES.md, docs/index.html, .github/workflows/pages.yml

## Proof

\`https://nhhthong.github.io/sheetstamp\` serves the download page, and the repository shows an MIT license.

## Acceptance criteria

- [ ] \`LICENSE\` is MIT and GitHub detects it.
- [ ] The Pages site is live with Windows and Ubuntu buttons, instructions in Vietnamese and the signing policy section.
- [ ] \`THIRD-PARTY-NOTICES.md\` lists runtime dependencies with their licenses.
- [ ] Two-factor authentication is on for the account (owner confirms).

EOF_BODY
t12=$(gh issue create --repo "$REPO" --title "T-12: Repo and pages" --body-file "$tmp/t12.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t12"
echo "T-12 -> #$t12"

echo done
