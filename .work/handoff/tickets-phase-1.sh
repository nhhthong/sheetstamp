#!/usr/bin/env bash
# Creates the Phase 1 epic and its tickets on GitHub. Run once from a clone, logged in with `gh auth login`.
set -euo pipefail
REPO=nhhthong/sheetstamp

for l in epic feature task bug spike in-progress; do gh label create "$l" --repo "$REPO" --force >/dev/null 2>&1 || true; done

dbid() { gh api "repos/$REPO/issues/$1" --jq .id; }
add_sub() { gh api --method POST "repos/$REPO/issues/$1/sub_issues" -F sub_issue_id="$(dbid "$2")" >/dev/null; }
add_blocker() { gh api --method POST "repos/$REPO/issues/$1/dependencies/blocked_by" -F issue_id="$(dbid "$2")" >/dev/null || echo "could not link #$2 as blocker of #$1; set it by hand" >&2; }

tmp=$(mktemp -d)

cat > "$tmp/epic.md" <<'EOF_BODY'
Phase 1: the Word flow end to end. Template library, data import, column matching with preview, filename pattern, ZIP export, and the app shell.

Requirements: see `.work/spec-index.md` (R1, R2, R5-R10, R12, R14.4 for Word templates). Image templates, theme, Settings, packaging and release are Phase 2.

Exit: a user can import a CSV or Excel file, choose or create a Word template, fix the column mapping, set the file name pattern and get a ZIP of filled documents, on Windows and Ubuntu, with the end-to-end test passing.
EOF_BODY
epic=$(gh issue create --repo "$REPO" --title "Phase 1: Word flow end to end" --body-file "$tmp/epic.md" --label epic | sed 's#.*/##')
echo "epic #$epic"

# T-13
cat > "$tmp/t13.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The app looks like the product: a left sidebar with Tạo file, Mẫu and Cài đặt, each opening an empty page with the right Vietnamese title and subtitle. Colour tokens (background, panel, text, muted, line, accent, success, warning, danger) are CSS variables with light and dark values, a visible 2 px focus ring, reduced-motion support and a toast. All user-visible strings live in one Vietnamese strings module. The IPC layer gets one typed, validated entry per command, so later tickets only add commands.

## Requirements

R7.1, R7.2, R7.3, R7.4, R12.1, R12.3, R12.4, R14.4

## New infrastructure

Tailwind CSS v4, shadcn/ui components (Base UI), typed IPC layer

## Files

src/renderer (shell, components, strings), src/shared/ipc.ts, src/preload/index.ts, src/main/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` opens the built app, tabs through Tạo file, Mẫu and Cài đặt, switches page, and narrows the window until the sidebar becomes a top bar.

## Acceptance criteria

- [ ] Sidebar has exactly three destinations, the current one highlighted, all reachable by keyboard with a visible focus ring.
- [ ] Below about 820 px width the sidebar becomes a top bar and two-column layouts stack.
- [ ] A toast appears for about 2.5 s and is announced to screen readers.
- [ ] Colour tokens exist for light and dark; status is never shown by colour alone (marker plus text).
- [ ] Every IPC command validates its argument in main and rejects bad input (test).
- [ ] Shadcn-style Button, Input, Select, Dialog and Toast components exist and are used by the pages.

EOF_BODY
t13=$(gh issue create --repo "$REPO" --title "T-13: App shell and ipc" --body-file "$tmp/t13.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t13"
echo "T-13 -> #$t13"

# T-14
cat > "$tmp/t14.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

Show any row's result the way Word would: the main process fills the template with the real engine using marker characters around each value, and the renderer shows the bytes with docx-preview, highlights the values and prints \`(trống)\` in red for an empty one and \`(thiếu)\` for a tag with no mapping. Decision and evidence: \`prototypes/phase1\` (docx-preview over mammoth, which loses the header and footer).

## Requirements

R9.4

## New infrastructure

docx-preview 0.4.1 (renderer), jszip

## Files

src/renderer/preview, src/main/preview, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` shows a filled sample contract as pages, with filled values highlighted and an empty value shown as (trống) in red, for two different rows.

## Acceptance criteria

- [ ] The preview shows page layout, header, footer and table borders of a sample contract.
- [ ] Filled values are highlighted; an empty value shows (trống) in red; an unmapped tag shows (thiếu).
- [ ] Changing the row shows the new values in under 500 ms on the sample.
- [ ] The preview never uses real export values in the markers' place: the exported file has no marker characters (test).
- [ ] A document docx-preview cannot draw falls back to a plain text view with a notice instead of an empty panel.

EOF_BODY
t14=$(gh issue create --repo "$REPO" --title "T-14: Word preview" --body-file "$tmp/t14.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t14"
add_blocker "$t14" "$t13"
echo "T-14 -> #$t14"

# T-15
cat > "$tmp/t15.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The logic that fills the mapping automatically. For each field of a template, find the column: exact match after removing diacritics against the tag key and its label, then the HR synonym list, then fuzzy matching (fuse.js, threshold tuned on the fixtures). A mapping profile says, for each field, a column, a fixed text or empty, and is recomputed when the data's columns change: it keeps choices that are still valid and reports fields that lost their column. The HR dictionary (display labels and synonyms) is compiled into the app bundle, not read from disk at run time.

## Requirements

R2.1, R2.3, R2.4, R2.5

## New infrastructure

fuse.js

## Files

src/main/mapping, data/hr-dictionary.json, tests/fixtures/mapping

## Proof

\`npm test\` passes the matching suite: exact without diacritics, synonyms, fuzzy, and the mapping profile recompute when columns change.

## Acceptance criteria

- [ ] Matching tries exact, then synonyms, then fuzzy, and reports which rule matched.
- [ ] A column named "Họ và tên" matches the field ho_ten; "SĐT" matches so_dien_thoai; fixture tests show no wrong match among near-miss names.
- [ ] Changing the data file keeps valid choices and lists the fields that lost their column.
- [ ] A field with no column stays unmatched: it is never mapped by a weak guess below the threshold.
- [ ] The dictionary is part of the built bundle (test reads it from the built output).
- [ ] Label suggestion for a tag: dictionary entry, else underscores replaced by spaces with a capital first letter.

EOF_BODY
t15=$(gh issue create --repo "$REPO" --title "T-15: Column matching" --body-file "$tmp/t15.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t15"
echo "T-15 -> #$t15"

# T-16
cat > "$tmp/t16.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

Local storage as decided in ADR 0001: a \`Storage\` interface and a JSON-file implementation in the app's data folder, with atomic writes (temporary file then rename). It keeps templates (metadata, tag labels, filename pattern, group, note, last-used date), groups, mapping profiles and the remembered choices, and a copy of each template's source file. Files carry a schema version; an unreadable file is moved aside as \`.bak\` and the app starts with an empty store and a message.

## Requirements

R10.4, R8.8

## New infrastructure

none

## Files

src/main/storage, tests/storage

## Proof

\`npm test\` passes the storage suite: round trip, crash during write leaves the old file readable, corrupt file moved aside.

## Acceptance criteria

- [ ] Writes are atomic: a simulated crash between temp write and rename leaves the previous data intact.
- [ ] A corrupt JSON file is renamed \`.bak\`, the app starts empty and says so.
- [ ] Template source files are copied into the data folder and read back byte for byte.
- [ ] Schema version is stored; an unknown newer version is refused, not overwritten.
- [ ] No imported CSV or Excel data is ever written (test scans the data folder after a run).

EOF_BODY
t16=$(gh issue create --repo "$REPO" --title "T-16: Json storage" --body-file "$tmp/t16.md" --label task | sed 's#.*/##')
add_sub "$epic" "$t16"
echo "T-16 -> #$t16"

# T-17
cat > "$tmp/t17.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The Mẫu page for Word templates: the list (name, group, source file, tag count, last used, note), the new-template dialog (drop zone for \`.docx\`, name filled from the file name, group dropdown with "+ Thêm nhóm mới…", optional note, collapsed list of found tags with editable labels from the dictionary), deletion with "Xóa mẫu này? Xóa | Giữ lại" in place, and the default groups. Loop marks and tags found only in footnotes are listed as unsupported with a warning. A duplicate name in the same group shows a warning under the name field.

## Requirements

R8.1, R8.2, R8.4, R8.5, R8.6, R8.7, R8.9, R3.3

## New infrastructure

none

## Files

src/renderer/templates, src/main/templates, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` creates a Word template from a fixture, sees it in the Tài liệu list with its tag count, then deletes it with the inline confirmation.

## Acceptance criteria

- [ ] Creating a template from a \`.docx\` shows "Đã lưu mẫu." and the row with the right tag count.
- [ ] Tags are deduplicated; loop and footnote tags are flagged as unsupported in the dialog.
- [ ] Each tag shows a suggested label and the user can edit it; labels persist.
- [ ] Default groups exist (Hợp đồng, Nghỉ việc, Tài liệu khác); "+ Thêm nhóm mới…" creates one on the spot.
- [ ] Deleting asks in place, then removes the template, its stored copy and its mapping profile.
- [ ] A duplicate name in the same group shows a warning and does not block saving.
- [ ] An empty list shows "Chưa có mẫu tài liệu nào." and a "Tạo mẫu đầu tiên" button.

EOF_BODY
t17=$(gh issue create --repo "$REPO" --title "T-17: Template library create" --body-file "$tmp/t17.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t17"
add_blocker "$t17" "$t13"
add_blocker "$t17" "$t15"
add_blocker "$t17" "$t16"
echo "T-17 -> #$t17"

# T-18
cat > "$tmp/t18.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

Editing a Word template: change name, group, note, filename pattern and tag labels; replace the source file keeping the mapping profile (tags that no longer exist are flagged, new tags appear as unmatched); and the Manage groups dialog (rename, delete moves its templates to "Chưa phân nhóm").

## Requirements

R8.3, R8.6

## New infrastructure

none

## Files

src/renderer/templates, src/main/templates, tests/e2e

## Proof

\`npm run test:e2e\` replaces a template's file with a version that renames one tag and adds one, then checks the flags and that the mapping profile is kept.

## Acceptance criteria

- [ ] Replacing the file keeps the mapping profile; removed tags are flagged and new tags appear as unmatched.
- [ ] Name, group, note, pattern and labels can be edited and are saved.
- [ ] Manage groups renames and deletes; deleting a group moves its templates to Chưa phân nhóm.
- [ ] A failed replace (unreadable file) leaves the template unchanged and says why.

EOF_BODY
t18=$(gh issue create --repo "$REPO" --title "T-18: Template library edit" --body-file "$tmp/t18.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t18"
add_blocker "$t18" "$t17"
echo "T-18 -> #$t18"

# T-19
cat > "$tmp/t19.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The Tạo file page with its four-step list (active, done with an "Đổi" link, locked) and step 1, Dữ liệu: the drop zone and file picker (the path comes from the preload bridge, since the sandboxed renderer cannot read it), the loaded state (file name, rows, columns, "Chọn file khác"), the five-row table, warnings for empty cells and numeric ID columns with the zero-padding option, "Chữ hiển thị sai? Đổi bảng mã" with a five-row preview, the sheet selector for \`.xlsx\`, the \`.xls\` message and a Reload button. The data stays in the main process memory only.

## Requirements

R9.1, R9.2, R9.6, R1.1, R1.3, R1.5, R1.6

## New infrastructure

none

## Files

src/renderer/home, src/main/data-session, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` drops a Windows-1258 CSV, sees the five-row preview and the empty-cell warning, switches the encoding, and the app holds no copy of the data after restart.

## Acceptance criteria

- [ ] A \`.csv\` in Windows-1258 shows correct Vietnamese; changing the encoding refreshes the five-row preview.
- [ ] \`.xlsx\` with several sheets shows a selector; a numeric ID column shows the warning and the pad-with-zeros option.
- [ ] A \`.xls\` (also a renamed one) shows the message asking to re-save, inline in the step.
- [ ] After restarting the app the page is empty; Reload re-reads the file when it changed on disk.
- [ ] Steps follow the active, done and locked states; "Đổi" reopens a done step.
- [ ] The primary button is always bottom-left of the step.

EOF_BODY
t19=$(gh issue create --repo "$REPO" --title "T-19: Home step data" --body-file "$tmp/t19.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t19"
add_blocker "$t19" "$t13"
echo "T-19 -> #$t19"

# T-20
cat > "$tmp/t20.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

Step 2, Mẫu: a search box that ignores diacritics (matches name, group and note), group filter chips (the last choice is remembered), and the template list as large buttons (type icon, name, "Khớp x/y trường, <last used>", group label). Order: best column match first, then last used. "Tiếp tục" stays disabled until a template is selected; "+ Mẫu mới" opens the create dialog without leaving the flow; no templates shows "Tạo mẫu đầu tiên".

## Requirements

R9.3, R10.3, R9.7

## New infrastructure

none

## Files

src/renderer/home, src/main/templates, tests/e2e

## Proof

\`npm run test:e2e\` loads data, types "hop dong" in the search, finds "Hợp đồng" templates, and sees the best-matching template first.

## Acceptance criteria

- [ ] Typing "hop dong" finds templates in the group "Hợp đồng" and by note.
- [ ] With data loaded, templates are ordered by how many fields match columns, then by last use.
- [ ] The selected group chip is remembered for next time.
- [ ] Only one template can be selected per export; the summary line shows its name and group.
- [ ] "+ Mẫu mới" creates a template and returns to the flow with it selectable.

EOF_BODY
t20=$(gh issue create --repo "$REPO" --title "T-20: Home step template" --body-file "$tmp/t20.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t20"
add_blocker "$t20" "$t15"
add_blocker "$t20" "$t17"
add_blocker "$t20" "$t19"
echo "T-20 -> #$t20"

# T-21
cat > "$tmp/t21.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

Step 3, Ghép cột: the heading says how much work is left ("1 trường cần bạn chọn cột." or "Tất cả n trường đã ghép."); each unmatched field is a highlighted row with a marker, its label, a column dropdown ("Chọn cột…", all columns, "Nhập chữ cố định", "Để trống") and the explanation; matched fields hide behind "Xem n trường đã khớp" and can still be changed. The right side shows the sticky preview from T-14 with a pager "‹ Dòng 3/12 ›" that updates immediately. The mapping is saved with the template. "Tiếp tục" is disabled while a field is unresolved (leaving it empty counts as resolved).

## Requirements

R2.2, R2.3, R2.4, R9.4, R10.3

## New infrastructure

none

## Files

src/renderer/home, src/main/mapping, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` maps a template whose data has one oddly named column, fixes it by hand, pages through rows in the preview and continues.

## Acceptance criteria

- [ ] Unmatched fields are shown first and highlighted; matched ones are collapsed behind a link.
- [ ] Choosing a column, fixed text or empty resolves a field and updates the preview at once.
- [ ] The mapping is saved with the template and reused the next time that template meets matching columns.
- [ ] Changing the data file keeps valid choices and tells the user which fields lost their column.
- [ ] "Tiếp tục" stays disabled until every field is resolved.

EOF_BODY
t21=$(gh issue create --repo "$REPO" --title "T-21: Home step mapping" --body-file "$tmp/t21.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t21"
add_blocker "$t21" "$t14"
add_blocker "$t21" "$t15"
add_blocker "$t21" "$t16"
add_blocker "$t21" "$t19"
add_blocker "$t21" "$t20"
echo "T-21 -> #$t21"

# T-22
cat > "$tmp/t22.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The first half of step 4, Xuất file: the summary lines "Tên file <live example>" and "Lưu vào <folder>" with "Đổi" links; the filename editor (chips for fields in blue and fixed text in grey, each removable, "+ <field>" buttons, "Thêm chữ", the "Bỏ dấu tiếng Việt trong tên file" checkbox off by default and remembered, "Lưu mẫu tên này vào mẫu"); the pattern rules from T-7 shown as inline messages; the operating system folder picker with the last folder remembered. Nothing is exported yet.

## Requirements

R9.5, R5.5, R5.6, R10.3

## New infrastructure

none

## Files

src/renderer/home, src/main/export-settings, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` edits the filename pattern with chips, sees the live example for the first row, ticks "Bỏ dấu", and the folder and options are remembered after a restart.

## Acceptance criteria

- [ ] The live example updates as chips change and shows the sanitized name with its extension.
- [ ] Path characters in fixed text and unknown fields show the message from the rules; the primary button stays disabled.
- [ ] The diacritics checkbox defaults to off and is remembered.
- [ ] "Lưu mẫu tên này vào mẫu" saves the pattern with the template; the default pattern is \`{{ten}}\`.
- [ ] The folder picker opens at the last folder and the choice is remembered.

EOF_BODY
t22=$(gh issue create --repo "$REPO" --title "T-22: Home step export options" --body-file "$tmp/t22.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t22"
add_blocker "$t22" "$t21"
echo "T-22 -> #$t22"

# T-23
cat > "$tmp/t23.md" <<EOF_BODY
## Parent

Phase 1 epic (#${epic})

## What to build

The second half of step 4 and the end of the flow: the large "Xuất <n> file" button; progress "Đang tạo file… 5/12" with a bar and a text equivalent; "Hủy" saying nothing was saved; the done state ("Đã tạo <n> file", the ZIP path, "Mở thư mục", "<k> dòng bị lỗi" with a link to the CSV report, and "Tạo đợt mới" that clears everything); closing the window during an export asks for confirmation. Generation runs in the worker pool from Phase 0.

## Requirements

R9.5, R9.6, R7.5, R6.1, R6.3, R6.4

## New infrastructure

none

## Files

src/renderer/home, src/main/export-session, src/shared/ipc.ts, tests/e2e

## Proof

\`npm run test:e2e\` runs the whole flow on generated data (4 rows with one bad), ends with the ZIP on disk with 3 files and a report for row 4, and cancelling mid-way leaves nothing.

## Acceptance criteria

- [ ] The whole flow works end to end on generated data: a Windows-1258 CSV and a Word template with split tags, table, header and footer.
- [ ] A bad row does not stop the batch; the done state links to the CSV report with row numbers only.
- [ ] Cancel stops the workers and leaves no ZIP and no temporary file.
- [ ] Progress is announced as text; the bar is not the only signal.
- [ ] Closing the window during an export asks for confirmation; closing at other times does not.
- [ ] "Mở thư mục" opens the folder with the ZIP selected; "Tạo đợt mới" returns to step 1 with everything cleared.

EOF_BODY
t23=$(gh issue create --repo "$REPO" --title "T-23: Home step export run" --body-file "$tmp/t23.md" --label feature | sed 's#.*/##')
add_sub "$epic" "$t23"
add_blocker "$t23" "$t22"
echo "T-23 -> #$t23"

echo done
