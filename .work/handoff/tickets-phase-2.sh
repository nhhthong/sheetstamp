#!/usr/bin/env bash
# Creates the Phase 2 epic and its tickets on GitHub. Run once from a clone, logged in with `gh auth login`.
set -euo pipefail
REPO=nhhthong/sheetstamp

for l in epic feature task bug spike in-progress; do gh label create "$l" --repo "$REPO" --force >/dev/null 2>&1 || true; done

dbid() { gh api "repos/$REPO/issues/$1" --jq .id; }
add_sub() { gh api --method POST "repos/$REPO/issues/$1/sub_issues" -F sub_issue_id="$(dbid "$2")" >/dev/null; }
add_blocker() { gh api --method POST "repos/$REPO/issues/$1/dependencies/blocked_by" -F issue_id="$(dbid "$2")" >/dev/null || echo "could not link #$2 as blocker of #$1; set it by hand" >&2; }

tmp=$(mktemp -d)

cat > "$tmp/epic.md" <<'EOF_BODY'
Phase 2: image templates, theme, Settings, packaging and the first release.

Requirements: see `.work/spec-index.md` (R4, the image parts of R8 and R9, R10.1, R10.2, R10.6, R13, R0.10, R0.11, R6.6, R11.4).

Exit: a user can create an image template with an editor, export a ZIP of PNG or JPG files from a data file, choose the theme, read About, and the Windows and Ubuntu packages build and self-test in a dry run, ready for the owner to tag the first release.
EOF_BODY
epic=$(gh issue create --repo "$REPO" --title "Phase 2: image templates, theme, Settings, first release" --body-file "$tmp/epic.md" --label epic | sed 's#.*/##')
echo "epic #$epic"

# T-24
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Question: which background images can the image engine take safely? Measure with the Phase 0 render function and worker pool: size in bytes and pixels against time and memory per image (4,000 rows must still meet the provisional 120 s on 4 cores for a typical 1600x1000 image), whether `@napi-rs/canvas` applies EXIF orientation (phone photos), and how it treats progressive, CMYK, 16-bit and animated inputs. Decide the limits and the behaviour (reject with a message, or normalise on import) that the import dialog (T-28) enforces. Close through `explore-decide`.

## Requirements

R4.1, R8.8

## New infrastructure

none

## Files

prototypes/phase2/image-limits

## Proof

`node prototypes/phase2/image-limits/run.mjs` prints, for 1600x1000, 3000x2000 and 6000x4000 backgrounds, the render time per image and peak memory in a 3-worker pool, and whether a phone JPEG with EXIF orientation 6 and a CMYK JPEG draw upright and without error; the decision (limits) is written to `.work/notes.md`.

## Acceptance criteria

- [ ] The limits (bytes, pixels, accepted variants) are written as a decision with the measured numbers.
- [ ] EXIF orientation is either applied on import or rejected with a message; the choice has a measured reason.
- [ ] The prototype and its output are kept in `prototypes/phase2/image-limits` with the command to rerun it.
EOF_BODY
} > "$tmp/t24.md"
t24=$(gh issue create --repo "$REPO" --title "T-24: Spike: image background limits" --body-file "$tmp/t24.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t24"
echo "T-24 -> #$t24"

# T-25
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Question (O-14): the transitive dependency `buffers@0.1.1` (via exceljs) declares no license, and only OSI-approved licenses may ship. npm shows only the repository `substack/node-buffers`; raw GitHub content could not be read from the planning environment, so the license is unconfirmed. Find the license in the upstream repository, the tarball or the maintainer's statement and record the source. If it cannot be confirmed, decide between asking the maintainer, vendoring a licensed replacement, or replacing the xlsx reader behind its interface, and cut a ticket for the chosen route with `plan-ticket-change`. Close through `explore-decide`.

## Requirements

R11.4, R13.10, R14.5

## New infrastructure

none

## Files

.work/notes.md, docs/specification.md

## Proof

A decision note (confirmed license with a source, or the replacement plan) is in `.work/notes.md` and O-14 is closed in the spec index.

## Acceptance criteria

- [ ] The license is confirmed with a link to the evidence, or a replacement route is decided and ticketed.
- [ ] `THIRD-PARTY-NOTICES.md` no longer lists `buffers` as UNDECLARED when the license is confirmed.
- [ ] O-14 is marked resolved in the spec index with the evidence.
EOF_BODY
} > "$tmp/t25.md"
t25=$(gh issue create --repo "$REPO" --title "T-25: Spike: license of buffers" --body-file "$tmp/t25.md" --label spike | sed 's#.*/##')
add_sub "$epic" "$t25"
echo "T-25 -> #$t25"

# T-26
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Give the renderer what the image editor and the preview need, without putting native code in the window or the main thread: `fonts:list` (families and the styles they really have, rescanned when the window regains focus and when the list is opened), and `image:render` (one template layout plus one row of values, or the field labels as sample text, returns the PNG the export would draw). Both run the Phase 0 functions in the worker pool, so the preview and the export use the same drawing. A row-level failure comes back as a code (`font-missing`, `text-too-long`, `bad-background`), never as an exception. In the e2e build only, the test font from `tests/fixtures/fonts` is loaded so tests do not depend on the runner's fonts.

## Requirements

R4.3, R4.5, R4.6, R4.10, R14.6

## New infrastructure

none

## Files

src/shared/ipc/images.ts, src/main/ipc/images.ts, src/main/images, src/worker/render, src/renderer/lib/ipc.ts, tests/e2e

## Proof

`npm run test:e2e` (built with the test font) lists the family "Sheetstamp Test" with only the styles that have a face, and renders a one-box template with Vietnamese text to a PNG whose size equals the background; unit tests cover a font that is no longer installed.

## Acceptance criteria

- [ ] `fonts:list` returns families grouped by family with only the styles that exist; a style the family lacks is absent, and nothing is synthesised.
- [ ] A font installed while the app runs appears after the window regains focus, without a restart.
- [ ] `image:render` returns the same bytes as the export render function for the same input (compared in a test).
- [ ] A layout that names a font no longer installed returns `font-missing` with the field; the caller can show one message and nothing is substituted.
- [ ] Arguments of both channels are validated in main; an unknown channel or bad argument is refused (same rules as the other channels).
- [ ] The test font is loaded only in the e2e build.
EOF_BODY
} > "$tmp/t26.md"
t26=$(gh issue create --repo "$REPO" --title "T-26: Fonts and image render over IPC" --body-file "$tmp/t26.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t26"
echo "T-26 -> #$t26"

# T-27
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Make the packaged app complete enough to ship: an application icon (an original simple mark generated from an SVG by a script; the owner may replace it), the product name and version embedded in the Windows executable and installer (SignPath later requires it), a desktop entry and icon for the `.deb`, and the installer's uninstall entry. The release workflow already builds and self-tests the packages; this ticket makes it run end to end with the real renderer (editor and image export included once they land) and adds checks for the embedded metadata. Run it as a dry run (no tag) so nothing is published.

## Requirements

R13.1, R13.2, R13.5, R13.8, R14.3

## New infrastructure

Application icon (generated from an SVG in the repo), Windows file properties

## Files

build/icon.svg, build/icon.png, build/icon.ico, scripts/make-icons.mjs, electron-builder.yml, scripts/check-selftest.mjs, .github/workflows/release.yml

## Proof

A manual run of the `Release` workflow ("Run workflow", no tag) builds Windows, Ubuntu and macOS and the packaged self-test passes on each; `scripts/check-selftest.mjs` also reads the Windows exe's ProductName and FileVersion and the `.deb`'s control file and both match `package.json`.

## Acceptance criteria

- [ ] An icon exists in every size electron-builder needs, generated by a script from one SVG.
- [ ] The Windows exe shows the product name and version in its properties; the check script reads them and fails on a mismatch with `package.json`.
- [ ] The `.deb` installs a menu entry with the icon; `Sheetstamp-Setup-x64.exe`, `Sheetstamp-x64.deb` and `Sheetstamp-x64.AppImage` keep their fixed names.
- [ ] The packaged self-test (worker pool, Word engine, canvas, ZIP) passes on the three runners in a dry run.
- [ ] A dry run publishes nothing and the macOS build stays a one-day artifact.
EOF_BODY
} > "$tmp/t27.md"
t27=$(gh issue create --repo "$REPO" --title "T-27: Packaging, icon and release dry run" --body-file "$tmp/t27.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t27"
echo "T-27 -> #$t27"

# T-28
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

The Ảnh tab of Mẫu works like the Tài liệu tab: "+ Mẫu mới" opens the dialog with a drop zone "Thả ảnh nền (PNG, JPG) vào đây", name (from the file name), group, optional note and the duplicate-name warning. The file is checked by signature, not extension, against the limits decided in T-24, and a copy is kept in the data folder. Saving stores the template with an empty layout and continues to the image editor (the editor itself arrives in T-29; until then it returns to the list with "Đã lưu mẫu."). The list shows name, group, source file, number of fields and last used. Delete removes the record, the stored copy and the mapping after an inline confirmation. The layout (boxes) gets a versioned shape with validation here, stored in the opaque `imageLayout` field that storage already carries.

## Requirements

R4.1, R8.1, R8.2, R8.4, R8.7, R8.8, R8.9

## New infrastructure

none

## Files

src/renderer/pages/templates, src/main/templates, src/main/storage, src/shared/ipc/templates.ts, src/shared/image-layout, tests/e2e

## Proof

`npm run test:e2e` opens Mẫu, switches to the tab Ảnh, creates a template from a generated PNG, sees it listed with its source file name and "0 trường", deletes it after the inline confirmation, and the stored copy is gone from the data folder.

## Acceptance criteria

- [ ] A PNG or JPEG is accepted by signature; a renamed `.gif`, a file over the limits and an unreadable file each show an inline message that says how to fix it.
- [ ] The stored copy is kept in the app's data folder and the template keeps working after the original is moved.
- [ ] The layout has a `version` and a validator; a newer version is refused, a corrupt layout does not stop the list from loading.
- [ ] The tab Ảnh list and empty state ("Chưa có mẫu ảnh nào." with "Tạo mẫu đầu tiên") follow the spec; the Tài liệu tab is unchanged.
- [ ] Delete asks inline, removes the record, the stored copy and the mapping profile.
- [ ] A duplicate name in the same group shows a warning under the name field.
EOF_BODY
} > "$tmp/t28.md"
t28=$(gh issue create --repo "$REPO" --title "T-28: Library: image templates (create, list, delete)" --body-file "$tmp/t28.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t28"
add_blocker "$t28" "$t24"
echo "T-28 -> #$t28"

# T-29
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

The image editor sub-page (back link "‹ Mẫu"): the background at its real proportions fitted to the window, text boxes you can add, drag, resize in width and delete, each showing sample text (the first data row when data is loaded, otherwise the field label). react-konva only positions boxes; positions are stored in image pixels, not screen pixels. A box is bound to a field chosen from a dropdown of labels; the field list comes from the HR dictionary plus "+ Trường mới…" for a name typed by the user (see open point O-15 in the planning report). "Lưu mẫu" stores the layout. No undo or redo. The canvas always shows the real image, whatever the theme.

## Requirements

R4.2, R4.7, R4.9

## New infrastructure

react-konva and konva in the renderer bundle (licenses added to the notices list)

## Files

src/renderer/pages/templates/image-editor, src/renderer/pages/templates/TemplatesPage.tsx, src/shared/image-layout, package.json, scripts/third-party-notices.mjs, tests/e2e

## Proof

`npm run test:e2e` creates an image template, lands in the editor, adds two boxes with "+ Thêm chữ", drags one, deletes the other, saves, reopens and finds the remaining box at the saved position.

## Acceptance criteria

- [ ] Boxes can be added, dragged, resized in width and deleted with the pointer and moved with the arrow keys; the selected box has a visible outline.
- [ ] Positions and sizes are stored in background pixels and survive a window resize and a reopen.
- [ ] A field is chosen per box from the dictionary labels or a new field typed by the user; the number of distinct fields is shown in the library.
- [ ] Sample text is the first data row when data is loaded, otherwise the field label.
- [ ] react-konva and konva work under the CSP; their licenses appear in `THIRD-PARTY-NOTICES.md`.
- [ ] The editor is keyboard usable (select a box, move it, delete it) and announces selection to screen readers.
EOF_BODY
} > "$tmp/t29.md"
t29=$(gh issue create --repo "$REPO" --title "T-29: Image editor: canvas and boxes" --body-file "$tmp/t29.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t29"
add_blocker "$t29" "$t26"
add_blocker "$t29" "$t28"
echo "T-29 -> #$t29"

# T-30
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

The inspector for the selected box: Trường, Font (installed families only, with the note "Chỉ hiện font đã cài trên máy này."), Cỡ chữ, Màu (picker plus hex), Kiểu chữ (Thường, Đậm, Nghiêng, Đậm nghiêng; a style the family lacks is disabled), Căn lề, and a collapsed "Nâng cao" with maximum lines and what to do when the text is too long (shrink, wrap, truncate, report an error for that row), and "Xóa khung chữ này". "Xem trước" shows the bitmap from the same render function as export, so the user can confirm the font draws Vietnamese diacritics. When a saved font is no longer installed, one message appears when the template is opened and the user picks another installed font; nothing is substituted.

## Requirements

R4.2, R4.3, R4.4, R4.5, R4.6, R4.10

## New infrastructure

none

## Files

src/renderer/pages/templates/image-editor, src/shared/image-layout, src/renderer/strings, tests/e2e

## Proof

`npm run test:e2e` selects a box, picks the test font, sets size 48, colour `#c00000`, style Đậm, centre alignment and "Xem trước"; the preview image shows Vietnamese diacritics and its size equals the background; a layout naming a missing font shows one message when opened.

## Acceptance criteria

- [ ] Every control of the spec's inspector exists, is labelled and works by keyboard; with no box selected it tells the user to select one.
- [ ] A style the family has no face for is disabled, never synthesised.
- [ ] "Xem trước" calls the shared render function (T-26) and shows the result for the first data row, or the labels when no data is loaded.
- [ ] The four overflow behaviours are selectable and a too-long text under "report an error" is shown in the preview as the row-level message.
- [ ] A template whose font is gone shows one message on open; choosing another family clears it; saving with a missing font is refused with the fix next to the message.
- [ ] Colour must be a valid hex; invalid input keeps the last valid value and shows the reason.
EOF_BODY
} > "$tmp/t30.md"
t30=$(gh issue create --repo "$REPO" --title "T-30: Image editor: inspector and preview" --body-file "$tmp/t30.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t30"
add_blocker "$t30" "$t29"
echo "T-30 -> #$t30"

# T-31
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Update for image templates: edit name, group, note and filename pattern; "Sửa ảnh" reopens the editor with the saved boxes; replace the background image keeping the layout, flagging boxes that no longer fit inside the new image and keeping fields that still exist. The replacement is committed like the Word one (new copy, commit the record, then delete the old copy). Opening the template for edit shows the missing-font message from T-30 when it applies.

## Requirements

R8.3, R4.5

## New infrastructure

none

## Files

src/renderer/pages/templates, src/main/templates, src/shared/ipc/templates.ts, tests/e2e

## Proof

`npm run test:e2e` edits an image template's name, group and note, reopens its boxes in the editor, then replaces the background with a smaller image and sees the boxes that fall outside it flagged while the others keep their position.

## Acceptance criteria

- [ ] Name, group, note and pattern can be edited; duplicate-name warning works as in create.
- [ ] Replacing the image keeps boxes and mapping, and lists boxes outside the new image before saving.
- [ ] The old stored copy is deleted only after the record is committed; a failure leaves the old image in place.
- [ ] Editing the layout of a template used in an unfinished Home flow does not break the flow (the mapping step re-reads it).
- [ ] The Tài liệu edit path is unchanged.
EOF_BODY
} > "$tmp/t31.md"
t31=$(gh issue create --repo "$REPO" --title "T-31: Library: edit image templates" --body-file "$tmp/t31.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t31"
add_blocker "$t31" "$t30"
echo "T-31 -> #$t31"

# T-32
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Home accepts image templates in steps 2 and 3. Step 2 lists them with the image icon and ranks them by column match like Word ones (fields come from the layout). Step 3 reuses the mapping list (matched fields collapsed, unmatched first, column / fixed text / empty) and the preview panel shows the real rendered image for the current row from `image:render`, updating as the mapping changes. A missing font is reported inline in the step with the fix next to it. The mapping profile is saved per template as for Word.

## Requirements

R9.4, R2.1, R2.2, R2.3, R2.4, R4.6, R4.7, R8.5

## New infrastructure

none

## Files

src/renderer/pages/home, src/main/mapping, src/main/templates, src/shared/mapping, tests/e2e

## Proof

`npm run test:e2e` loads a CSV, picks an image template in step 2 (shown with the image icon and "Khớp x/y trường"), fixes the one unmatched field in step 3 and sees the rendered image change with the pager "‹ Dòng 2/4 ›".

## Acceptance criteria

- [ ] Image and document templates appear together in step 2 with the right icon; the group chips and search work for both.
- [ ] Fields for matching come from the boxes of the layout; labels come from the dictionary or the user's name for the field.
- [ ] Step 3 shows the rendered image for the current row and re-renders when the mapping changes, with no more than one render in flight.
- [ ] Unresolved fields block "Tiếp tục" exactly as for Word; leaving a field empty counts as resolved.
- [ ] A template with no boxes cannot be continued and says why; a missing font is shown inline.
- [ ] The saved mapping profile is reused when the same image template is chosen again.
EOF_BODY
} > "$tmp/t32.md"
t32=$(gh issue create --repo "$REPO" --title "T-32: Home: image templates in steps 2 and 3" --body-file "$tmp/t32.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t32"
add_blocker "$t32" "$t30"
echo "T-32 -> #$t32"

# T-33
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Step 4 and the run for image templates: choose the output format (PNG or JPG; default the format of the background, remembered; JPG quality fixed at a sensible value) with the extension appended to the file name, show the estimated total size (from a rendered sample, an estimate said as such), and run the export through the worker pool with the same progress, cancel, error report and done state as Word. Row-level render failures (`font-missing`, `text-too-long`, `bad-background`) become report codes and do not stop the batch. The packaged self-test already exercises this pipeline.

## Requirements

R4.8, R4.4, R9.5, R6.4, R6.5, R11.1

## New infrastructure

none

## Files

src/renderer/pages/home, src/main/export-session, src/main/export, src/worker, src/shared/ipc/export.ts, tests/e2e

## Proof

`npm run test:e2e` runs the whole flow with an image template and 4 rows (one with a text too long under "report an error"): the ZIP on disk holds 3 PNG files with the names from the pattern, the error report names row 4 with code only, and cancelling mid-way leaves nothing.

## Acceptance criteria

- [ ] PNG and JPG both export; the file extension matches and the live example shows it.
- [ ] The size line is shown for image templates only and is labelled as an estimate.
- [ ] A failed row is skipped and reported by row number and code only; the rest are exported.
- [ ] Cancel leaves no ZIP, no report and no temporary file, as for Word.
- [ ] 4,000 rows on 4 cores stay within the provisional 120 s with no UI freeze (extend `npm run bench` if needed) and the result is recorded for M3.
- [ ] The whole flow passes on Windows and Ubuntu in CI.
EOF_BODY
} > "$tmp/t33.md"
t33=$(gh issue create --repo "$REPO" --title "T-33: Home: export images" --body-file "$tmp/t33.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t33"
add_blocker "$t33" "$t32"
echo "T-33 -> #$t33"

# T-34
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Cài đặt gets the theme choice (Sáng, Tối, Theo hệ thống; default Theo hệ thống). The choice is saved in the local settings file, applied before the first paint (no flash), and follows the operating system live when set to system. It affects only the app interface. The contrast of text and every status colour (green, yellow, red, grey) is checked against WCAG AA in both themes by a test that reads the tokens.

## Requirements

R10.1, R10.6, R12.3

## New infrastructure

none

## Files

src/main/storage, src/main/ipc, src/shared/ipc, src/renderer/pages/settings, src/renderer/styles.css, src/renderer/lib, tests/e2e

## Proof

`npm run test:e2e` opens Cài đặt, picks Tối and sees `data-theme="dark"` on `<html>`, restarts the app and finds it still dark, picks Theo hệ thống and the page follows the emulated OS scheme live; a unit test checks the contrast ratio of every status colour in both themes.

## Acceptance criteria

- [ ] The three choices work; the saved choice is applied before the window shows its content.
- [ ] With Theo hệ thống the interface follows an OS change without a restart.
- [ ] The choice is stored in the settings file next to the other choices and a corrupt file falls back to the default.
- [ ] A test computes the contrast ratio of each status colour on its background in light and dark and fails below 4.5:1 for text.
- [ ] The image editor canvas and the generated files do not depend on the theme.
EOF_BODY
} > "$tmp/t34.md"
t34=$(gh issue create --repo "$REPO" --title "T-34: Theme choice" --body-file "$tmp/t34.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t34"
echo "T-34 -> #$t34"

# T-35
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

The About section of Cài đặt: version, MIT licence, third-party notices (the generated file is packaged with the app and shown in the window), the Electron end-of-support date, a link to the download page and the button "Kiểm tra bản mới", which only opens the download page in the default browser. The app makes no network call itself; opening the browser goes through one allow-listed command that accepts only the fixed URL.

## Requirements

R10.2, R10.5, R14.2

## New infrastructure

none

## Files

src/renderer/pages/settings, src/main/ipc/app.ts, src/shared/ipc/app.ts, src/main/index.ts, electron-builder.yml, tests/e2e

## Proof

`npm run test:e2e` opens Cài đặt > Giới thiệu and sees the version from `package.json`, the MIT licence, the third-party notices text, the Electron end-of-support date, and that "Kiểm tra bản mới" asks the main process to open exactly the download page URL; a test fails if the Electron major in `package.json` has no end-of-support date.

## Acceptance criteria

- [ ] Version, licence, notices and the Electron date are shown; the notices file is present in the packaged app.
- [ ] "Kiểm tra bản mới" opens `https://nhhthong.github.io/sheetstamp` through an allow-listed command; any other URL is refused.
- [ ] No background network call exists (a test blocks the network and the app starts and runs).
- [ ] A test fails when Electron's major version changes without an updated end-of-support date.
- [ ] `window.open` and navigation stay blocked in the renderer.
EOF_BODY
} > "$tmp/t35.md"
t35=$(gh issue create --repo "$REPO" --title "T-35: Settings: About" --body-file "$tmp/t35.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t35"
add_blocker "$t35" "$t34"
echo "T-35 -> #$t35"

# T-36
{
printf '## Parent\n\nPhase 2 epic (#%s)\n\n' "$epic"
cat <<'EOF_BODY'
## What to build

Close what stands between the green build and a public first release: regenerate the notices with the final dependency set, finish the download page (Vietnamese install steps; screenshots taken from the packaged app on Windows and Ubuntu), settle O-10 by checking the UTF-8 flag display of ZIP names on Windows 10/11, Ubuntu and, if reachable, macOS (including an NFD name), and write the clean-machine checklist (Windows per-user install, Ubuntu `.deb` and AppImage, VirusTotal scan, Defender warning noted). Claude does not publish: the report lists what the owner must do (enable Pages, 2FA, tag the release, apply to SignPath afterwards).

## Requirements

R13.7, R13.10, R11.4, R6.6, R0.10, R0.11

## New infrastructure

none

## Files

THIRD-PARTY-NOTICES.md, README.md, site/index.html, docs/specification.md, .work/phase-2-report.md

## Proof

A dry run of the `Release` workflow is green, `SHA256SUMS.txt` lists the three installers, the owner's checklist in `.work/phase-2-report.md` is complete, and the owner pushes the tag `v0.1.0` (publishing is the owner's action).

## Acceptance criteria

- [ ] The notices cover every shipped dependency and list no UNDECLARED license.
- [ ] The download page shows the three buttons with the fixed names, the checksum link, the install steps with screenshots, and the "Coming soon" note for macOS.
- [ ] O-10 is resolved in the spec index with the observed display on each operating system, or the gap is recorded as a known issue on the page.
- [ ] A report states the result of each clean-machine check, or that it is still owed by the owner and why.
- [ ] The release workflow's dry run passes and the publish step is untouched until the owner tags.
- [ ] No release is published, signed or submitted by Claude.
EOF_BODY
} > "$tmp/t36.md"
t36=$(gh issue create --repo "$REPO" --title "T-36: First release readiness" --body-file "$tmp/t36.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t36"
add_blocker "$t36" "$t25"
add_blocker "$t36" "$t27"
add_blocker "$t36" "$t31"
add_blocker "$t36" "$t33"
add_blocker "$t36" "$t35"
echo "T-36 -> #$t36"

echo done
