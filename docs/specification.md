# Sheetstamp: Project Specification

October 26, 2026 · @Thong · Revised October 26, 2026

## 1. Overview

Sheetstamp is an open-source (MIT-licensed), fully local desktop application that populates Word templates (`.docx`) or image templates with data from CSV/Excel files, then exports the generated files in bulk as a single ZIP archive.

- **Target users:** HR, accounting, and administrative staff at small and medium-sized businesses in Vietnam. They are not technically savvy and are expected to primarily use Windows (assumption; not validated through research, and the owner has decided not to validate it before building).
- **Problem:** Teams need to generate contracts, payroll documents, transfer letters, congratulatory images, and similar materials for hundreds or thousands of people. Word Mail Merge is cumbersome, and sensitive data should not be uploaded to the cloud.
- **Value proposition:** Drag-and-drop templates and data; automatically match columns to placeholders (including Vietnamese text with diacritics, with user confirmation); work entirely offline; export everything in one ZIP archive using customizable filenames.
- **MVP success criteria:** Process 4,000 rows into a ZIP without freezing the UI; support cancellation; map every placeholder or clearly flag it; prevent one failed row from breaking the rest of the batch; run offline; and pass the golden-file test suite on Windows and Ubuntu.

## 2. Decisions Finalized

The following decisions have been finalized.

| Item | Decision |
| --- | --- |
| Product name | Sheetstamp |
| Repository | `github.com/nhhthong/sheetstamp` (public, personal account) |
| Download page | `nhhthong.github.io/sheetstamp` (default GitHub Pages domain; no custom domain) |
| App identifier | `io.github.nhhthong.sheetstamp`, set once and never changed |
| License | MIT |
| Placeholder syntax (without diacritics) | `{{ten}}` |
| Output filename | The user enters a pattern containing tags, e.g. `{{ten}}` becomes `Nguyễn A.docx`; the extension is appended automatically |
| Input formats | `.csv` and `.xlsx` only. `.xls` is rejected with a message asking the user to re-save as `.xlsx` or `.csv`. |
| Platforms | Windows 10 and 11 x64; Ubuntu 22.04 and 24.04 x64; macOS on Apple Silicon for internal testing only |
| Distribution | GitHub Releases for installers (fixed filenames, e.g. `Sheetstamp-Setup-x64.exe`); GitHub Pages for the download page. macOS is marked “Coming soon”; no public macOS build yet |
| Code signing | Windows: unsigned for the first release, then apply to SignPath (free for open-source projects). **If SignPath rejects the application, publish through the Microsoft Store (MSIX) as the backup; otherwise do not publish to the Store.** Ubuntu: not required; macOS: ad hoc signing for test builds |
| Data and networking | Do not store CSV/Excel data; no telemetry; no automatic updates; UI in English (default) and Vietnamese, chosen in Settings (owner decision, 2026-10-29) |
| MVP scope | Both export modules (Word and image) stay in the MVP. The owner has accepted that the scope is large for one person. |
| Theme and settings | Light, Dark, and System themes (default: System). A simple Settings screen (see section 5). |
| Fonts | Only fonts installed on the user's computer are listed and used. The app bundles no fonts and does not let users add font files; users install new fonts through the operating system. |
| User interface | Extremely simple, for non-technical HR and accounting staff. Three sidebar destinations only (Tạo file, Mẫu, Cài đặt). One task visible at a time. The app remembers the user's last choices instead of asking for settings. Full description in section 5.1; a clickable mock exists as a reference (not part of the deliverables). |

## 3. Core Technology Stack

The team will decide the directory structure and coding conventions. The table below lists only the main technologies. Electron, electron-vite, and electron-builder versions were checked on October 26, 2026; all other dependencies must be verified when implementation begins.

| Layer | Choice | Notes |
| --- | --- | --- |
| Shell | Electron, TypeScript | Use Electron 45 (stable as of October 20, 2026; Chromium M156, Node 24; end of support: April 27, 2027). Electron has no LTS: only the three latest major versions are supported, and only the latest minor of each. A major version is therefore supported for about six months. Upgrade to the newest stable major every 3–4 months, because the app does not auto-update. |
| Build and packaging | electron-vite, electron-builder | electron-vite 5 is stable (version 6 is in beta); electron-builder 26.x (v27 is in alpha). electron-vite has only one maintainer; Electron Forge is the fallback. Native modules (`.node` files) cannot load from inside the ASAR archive: unpack them (`asarUnpack`) and test the packaged build, not only the dev build. |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base UI) | Component source code will be copied into the repository and maintained in-house. Implement themes with color tokens that switch on a class or data attribute on the root element. Follow the operating system through Electron's `nativeTheme` (verify the API against Electron 45 documentation). |
| Word template population | easy-template-x (MIT) | Configure `{{ }}` as delimiters; list tags with `parseTags`; loops and images are available for free. Its documentation says each tag is isolated into its own text node, which suggests split runs are handled. Header/footer support and tags with diacritics are unverified. Keep it behind a `TemplateEngine` interface so it can be replaced. |
| Data reading | papaparse (CSV), exceljs (read-only), fuse.js, date-fns | exceljs is no longer actively maintained and does not read `.xls`. exceljs returns numeric cells as numbers, so leading zeros are lost unless the cell's displayed text is used (see Input data). For encoding hints prefer `chardet` (MIT) over `jschardet` (LGPL). |
| Image templates | `@napi-rs/canvas` (Skia) for drawing; react-konva for positioning text boxes | “Preview” must use the exact same rendering function as export. Use only fonts installed on the user's computer: `@napi-rs/canvas` loads the operating system's fonts by default (including the per-user font folders on Windows, macOS, and Linux), so installed fonts can be listed. Do not bundle or register any other font in the app. In automated tests, set `DISABLE_SYSTEM_FONTS_LOAD` and register a test-only font file kept in the test fixtures (never shipped in the installer) so results do not depend on the machine. |
| ZIP compression | archiver (streaming) | Source code has been reviewed: non-ASCII filenames are marked as UTF-8. Display behavior still needs testing on Windows, macOS, and Ubuntu. |
| Storage | Local JSON files | SQLite is deferred until after the MVP. |
| Quality and CI | Vitest, Playwright, Biome; GitHub Actions on all three operating systems | Sign Windows builds with SignPath after the first release. Golden-file tests: compare normalized XML for Word output; compare images with a pixel-difference threshold on a single reference operating system. |

## 4. Architecture

The UI only displays information and sends commands. Heavy work—reading data, populating templates, rendering images, and creating ZIP archives—runs in a background process so the window remains responsive. Everything stays on the user's machine.

[Embedded content: architecture · four layers, with heavy work running in a background process]

Arrows are bidirectional: commands flow downward; progress updates and results flow upward.

## 5. MVP Features

The MVP includes two export modules—Word templates and image templates—that share the data, mapping, filename, and ZIP-export components.

| Feature | Description |
| --- | --- |
| Input data | `.csv` and `.xlsx` (with sheet selection); `.xls` is rejected (check both the extension and the file signature, so a renamed `.xls` is also caught). Encoding detection order: BOM, then strict UTF-8 validation, then Windows-1258 as the default fallback; always provide an encoding dropdown with a five-row preview. TCVN3 and VNI are not supported. Detect delimiters automatically; normalize to NFC. Preserve leading zeros (national ID numbers, phone numbers): read the displayed cell text for `.xlsx`, warn when an ID-like column is stored as a number, and offer a per-column “pad with zeros to N characters” option. Show the first five rows and scan the entire file in the background to report empty cells and mixed data types. |
| Mapping | Match automatically in this order: exact match after removing diacritics (compare the column name with both the tag and its label), then fuzzy matching. There is no synonym dictionary. **Word templates** are matched by name this way. **Image templates** are matched by position: field 1 gets the first column, field 2 the second, and so on, left to right. **One column serves one field:** if a column is already used by another field, the app assigns it to the first field in template order and leaves the others unmatched; the user can still change any choice. The screen is a list, not a two-pane diagram (see section 5.1, step 3): fields the app matched are collapsed behind a green check; fields without a matching column are highlighted and shown first. For a field without a matching column, offer: choose another column, enter a fixed text, or leave empty (with a warning in the preview). Choosing a column that another field already uses moves the column to the chosen field; the other field becomes empty and shows a small alert icon with the text “Cột này đã chuyển sang trường khác.” until the user picks again. Fixed text and “Để trống” are not limited by this rule. **Deferred beyond the MVP:** concatenating columns, value transformations, and asking for a value at export time. Save the mapping per template and preview the result for any row. |
| Word templates | Import `.docx`; scan for `{{...}}` placeholders in the document body, tables, headers, and footers; replace text while preserving formatting. On import, extract all tags automatically (remove duplicates; flag loop and condition marks such as `{{#...}}` and `{{/...}}` as unsupported) and derive a display label for each tag (see Template library). A tag name is any text between `{{` and `}}`; use names that cannot collide with ordinary text in the document, so numbers alone such as `{{1}}` are not recommended. Image insertion and dynamic tables are not supported initially. To edit a template, modify it in Word and upload it again. |
| Image templates | Import PNG or JPEG; position text boxes and configure, for each box: position, font family, font size (in image pixels), color (color picker plus hex input), style (Normal, Bold, Italic, or Bold Italic), alignment, and maximum line count. One style applies to the whole text box; mixed styles inside one box are not supported. Fonts are the families installed on this computer, grouped by family, and a style is offered only if the family has a face for it (no synthetic bold or italic until tested). If text is too long, shrink the font, wrap, truncate, or report an error for that row. The app bundles no fonts and has no way to add font files: it only lists fonts installed in the operating system, and users install new fonts through the operating system. Templates stay on this computer (there is no template export or import), so a missing font is rare, for example when the user uninstalls a font after saving the template. In that case show one message when the template is opened or exported and let the user choose another installed font; the app never substitutes a font automatically. Use Preview to check that a chosen font draws Vietnamese diacritics correctly. Include a “Preview” button and export to PNG or JPEG. Use react-konva only for dragging text boxes; render the preview bitmap with the same Skia function as export. **Fields:** adding a text box asks for its field name as free text (for example “Họ và tên”), with no suggestions; the name is the field's label and can be edited later. Fields are numbered 1, 2, 3… in the order they were added, the number is shown in the editor, and deleting a field renumbers the rest. When data is imported, field *n* is matched to the *n*th column (see Mapping); a field without that column is left for the user to match. Preview uses the first row of the imported data when data is loaded, and otherwise each field's label as sample text. Undo and redo are not included in the first version. |
| Filenames | Let users enter a pattern containing tags, e.g. `{{ten}}` becomes `Nguyễn A.docx`, with a live example based on the first row. Sanitize Windows-invalid characters and reserved names; reject `/`, `\`, and `..`. Truncate names so the full destination path stays within the Windows 260-character limit. Detect duplicates case-insensitively after NFC normalization and add a sequence number; use the row number when a tag is empty; optionally remove diacritics. The pattern is saved with the template (default `{{ten}}`) and is shown, with its live example, for review at the Export step before every export; a change made there applies to that export and can be saved back to the template. |
| ZIP export | Choose a destination folder; write the ZIP as a stream to a temporary file and rename it on completion; delete the temporary file on cancel or failure; show progress and provide a Cancel button. A row-level error must not stop the batch; export an error report as CSV containing only the row number and an error code (no source data). In that CSV, prefix any cell that starts with `=`, `+`, `-`, or `@` with a tab character to prevent formula injection. |
| Navigation | A left sidebar with three destinations: **Tạo file** (Home, the export flow), **Mẫu** (templates: one page with two tabs, “Tài liệu” and “Ảnh”), and **Cài đặt** (Settings). Tạo file is for using templates; Mẫu is for managing them. The template editor for images opens as a sub-page of Mẫu with a “‹ Mẫu” back link. On narrow windows the sidebar becomes a top bar. |
| Template library | The Mẫu page shows the saved templates of the selected tab (Tài liệu or Ảnh) with a “+ Mẫu mới” button. **Create:** import a `.docx` (or a PNG/JPEG for images) and set a name (default: the file name without its extension), a group, and an optional note; for images, place the text boxes. **Read:** the list shows name, group, source file name, number of tags, and last-used date; opening a template shows its tags, note, filename pattern, and mapping profile. **Update:** edit the name, group, note, and filename pattern; replace the source file (the mapping profile is kept, tags that no longer exist are flagged, and new tags appear as red); for images, edit the text boxes. **Delete:** removes the template, its stored copy, and its mapping profile after a confirmation. An empty list shows a “Create new” prompt. **Tag labels:** on import, each extracted tag gets a display label that the interface shows instead of the raw tag: the tag with underscores replaced by spaces and the first letter capitalized (for example `{{ho_ten}}` is shown as “Ho ten”). There is no built-in dictionary. The user can edit any label (for example to “Họ và tên”). Labels exist only in the app: the placeholder in the document stays `{{ten}}`, and labels are stored with the template. **Groups:** each template belongs to exactly one group, and the group list is shared by both kinds of templates. Default groups: “Hợp đồng”, “Nghỉ việc”, “Tài liệu khác” (all editable). “+ Add new” in the group field creates a group on the spot; a Manage groups dialog on the Mẫu page renames and deletes groups, and deleting a group moves its templates to “Chưa phân nhóm”. Saving a template with a name that already exists in the same group shows a warning. |
| Home (export flow) | The main screen, where every export happens, in four steps: **1. Data** (import `.csv` or `.xlsx`; see Input data), **2. Template**, **3. Mapping & preview**, **4. Export**. The steps are sequential and only the current step is expanded (see section 5.1). One template per export. **Template picker:** a searchable list (not a dropdown) of both kinds of templates. Each row shows a type icon, the group, and the name as separate labels, not one concatenated string. Search ignores diacritics (typing “hop dong” finds “hợp đồng”) and matches name, group, and note; filter by group. The default order is last used first; when data is loaded, templates whose tags match more of the data's columns are ranked higher. **Export step:** review the filename pattern (saved with the template, shown with a live example), choose the destination folder, see the estimated total size for image exports, then export with progress and Cancel. Imported data is never stored: after the app restarts, Home is empty, and a Reload button re-reads the file if it changed on disk. When no template exists yet, Home points to “Create your first template”. The mapping profile belongs to the saved template. |
| Theme | Light, Dark, or System (default: System, follows the operating system and updates live). The choice is saved in the local settings file. Themes affect only the app interface: the image-template canvas and its preview always show the real image, and generated files never depend on the theme. Every screen and status color (green, yellow, red, gray) must be checked for contrast in both themes. |
| Settings | One simple screen opened from the sidebar, outside the export flow. Contents: theme; About (version, the local-only line, Electron end-of-support date, link to the download page, and a “Check for new version” button that opens the download page in the default browser; the app never downloads or installs updates and makes no background network calls). The output folder and the “remove diacritics” choice are not settings: the app remembers the last output folder, and the diacritics choice is a checkbox in the filename editor (remembered, default off). The interface stays in Vietnamese only. Settings are stored in the local JSON settings file; no data from CSV/Excel files is stored. |
| Storage | Local JSON files for template metadata, mapping profiles, and settings. Each saved template also keeps a copy of its source file (the `.docx`, or the background image) in the app's data folder, so templates keep working if the original file is moved. Do not store CSV/Excel data. |

**Quality requirements**

- **Performance:** Process 4,000 rows without freezing the UI. Measure on a low-end machine (4 cores, standard SSD); set the final time target after benchmarking. Use a worker pool sized to the CPU cores by default (generating `.docx` files is CPU-bound in JavaScript).
- **Privacy and security:** Fully offline, no telemetry, and no Node.js access from the renderer process. Also enable `contextIsolation` and sandboxing, set a Content Security Policy, validate all IPC arguments, block navigation and `window.open`, and limit input file size.
- **Vietnamese support:** NFC normalization, correct CSV encoding detection, and a Preview that lets the user confirm that the chosen installed font draws combining diacritics correctly.
- **Dependency licensing:** Use only libraries with OSI-approved licenses. The app bundles no fonts. Do not bundle paid modules (SignPath reviews third-party components as well).

### 5.1 User Interface Specification

All user-visible text is written twice, English (default) and Vietnamese, in sentence case, with plain verbs; the language is chosen in Settings and applied by reloading the page (owner decision, 2026-10-29). The examples below are the Vietnamese texts. An action keeps one name everywhere (the button “Xuất 12 file” leads to “Đã tạo 12 file”). Errors say what happened and how to fix it, without apology.

**Design principles**

1. Three destinations, one task at a time. Nothing is shown that the user does not need right now.
2. Defaults and memory over settings: the app remembers the last output folder, last group filter choice, and filename options.
3. The app does the matching; the user only handles exceptions (unmatched fields, empty cells).
4. Every destructive action is confirmed in place (inline), never with a blocking system dialog, except where the operating system requires it.
5. One primary button per screen, always in the same place (bottom-left of the content, below the step).
6. No jargon in the interface: “trường” (field), “cột” (column), “mẫu” (template). Raw tags such as `{{ho_ten}}` appear only in the template dialog.

**Visual system**

- Colors are tokens: background, panel, text, muted text, line, one accent (blue), success, warning, danger. Light and Dark values are defined for each; System follows the operating system live. Contrast is checked in both themes.
- Typography: the operating system's UI font (Segoe UI on Windows, the system font on Ubuntu). Page title 32 px bold; step title 20 px semibold; body 16 px; secondary text 14 px muted. Line length stays under 80 characters.
- Spacing is generous (about 44 px page padding on desktop). Corners are rounded (about 10–18 px). Cards and shadows are not used to group content; thin divider lines are.
- Keyboard focus is always visible (2 px accent outline). Every control is reachable by keyboard. Animations are limited to progress and state changes and are disabled when the system asks for reduced motion.
- Minimum window size to be set after testing; below about 820 px width the sidebar becomes a top bar and the two-column layouts stack.

**Shell**

- Left sidebar (about 224 px): app name, then three items with an icon each: Tạo file, Mẫu, Cài đặt. The current item is highlighted with the accent color. The sidebar has no other content.

**Screen 1: Tạo file (Home)**

Title “Tạo file hàng loạt”, subtitle “Làm theo từng bước. Mỗi lần chỉ một việc.” Below, four steps in a vertical list separated by thin lines. Each step has a round marker (number, or a green check when done), a title, and a state:

- **Active:** expanded with its content.
- **Done:** collapsed to one summary line plus an “Đổi” (Change) link that reopens it. Reopening an earlier step keeps later choices that are still valid (for example, changing the data file keeps the template; the mapping is recomputed and the user is told if fields lost their match).
- **Locked:** greyed title only; cannot be opened until the previous step is done.

*Step 1, Dữ liệu.*
- Empty state: one large drop zone, “Thả file Excel hoặc CSV vào đây / hoặc bấm để chọn file”. A `.xls` file shows the message from Input data.
- Loaded state: a line with file name, row count and column count and a “Chọn file khác” link; a table of the first five rows; when empty cells are found, a warning line (“2 ô trống ở cột Email”); a hint “Chữ hiển thị sai?” with an “Đổi bảng mã” link that opens the encoding dropdown with the five-row preview; for `.xlsx` with several sheets, a sheet selector appears above the table; for ID-like numeric columns, a warning with the pad-with-zeros option. Primary button “Tiếp tục”.
- Summary when done: “<file name>, <n> dòng, <m> cột”.

*Step 2, Mẫu.*
- A search box (“Tìm mẫu theo tên, nhóm hoặc ghi chú”; ignores diacritics), then a row of group filter chips (“Tất cả” plus each group), then the template list.
- Each list row is one large button: type icon (document or image), name in bold, a hint line “Khớp x/y trường, <last used>”, and the group as a small label on the right. The selected row has an accent outline. Order: best column match first, then last used.
- “Tiếp tục” is disabled until a template is selected. A “+ Mẫu mới” link opens the new-template dialog without leaving the flow. With no templates, the step shows “Tạo mẫu đầu tiên”.
- Summary when done: “<template name> (<group>)”.

*Step 3, Ghép cột.*
- Two columns (stacked on narrow windows). Left: the mapping list. Right: a sticky preview panel.
- Mapping list: a heading states the work left (“1 trường cần bạn chọn cột.”), or “Tất cả n trường đã ghép.” when none remains. Each unmatched field is a highlighted row with a warning marker, the field label, a column dropdown (“Chọn cột…”, all columns, “Nhập chữ cố định”, “Để trống”), and the explanation “Chưa có cột nào giống ‘<label>’. Chọn cột khác, nhập chữ cố định hoặc để trống.” Choosing “Nhập chữ cố định” shows a text box. Matched fields are hidden behind a link “Xem n trường đã khớp”, which expands rows that can be changed the same way. Every row, matched or not, shows the chosen column's value from the first data row, so the user can confirm the match at a glance. A row whose column was taken by another field shows the alert icon described in Mapping.
- Preview panel: a pager “‹ Dòng 3/12 ›” and the rendered result for that row. For a document template, a page-like preview in which filled values are highlighted and an empty value is shown as “(trống)” in red. For an image template, the real rendered image. The preview updates immediately when the mapping changes.
- “Tiếp tục” is disabled while any field is still unresolved (leaving a field empty counts as resolved).

*Step 4, Xuất file.*
- Two summary lines, each with an “Đổi” link: “Tên file <live example from the current row>” (the pattern is shown as chips when edited) and “Lưu vào <folder>” (opens the operating system's folder picker; default is the last folder used).
- Filename editor (opened by “Đổi”): a row of chips representing the pattern, where field chips are blue and fixed-text chips are neutral, each with a × to remove; below, “Thêm:” followed by one “+ <field>” button for each field of the template, a text box with “Thêm chữ” for fixed text such as `_Thử việc`, and the checkbox “Bỏ dấu tiếng Việt trong tên file”. A link “Lưu mẫu tên này vào mẫu” saves the pattern back to the template. The live example is the file name after sanitizing, with the extension.
- For image templates, a line with the estimated total size.
- Primary button, large: “Xuất <n> file”.
- While exporting: “Đang tạo file… 5/12”, a progress bar, and a “Hủy” button. Cancelling says that nothing was saved.
- Done: a large green check, “Đã tạo <n> file”, the ZIP path, a primary button “Mở thư mục”, and a link “Tạo đợt mới” that returns to step 1 with everything cleared. If some rows failed, a warning line “<k> dòng bị lỗi” with a link to the CSV error report is shown.

**Screen 2: Mẫu**

- Title “Mẫu”, subtitle “Tạo một lần, dùng lại cho mọi lần xuất.” A segmented control “Tài liệu | Ảnh” on the left and a primary “+ Mẫu mới” button on the right.
- Each row: type icon, name in bold, hint “<n> trường, <last used>” plus the note when present, the group label, and the actions “Sửa” and “Xóa”. “Xóa” turns the row's actions into “Xóa mẫu này? Xóa | Giữ lại”; nothing else on the page changes.
- Empty list: “Chưa có mẫu <tài liệu/ảnh> nào.” with a “Tạo mẫu đầu tiên” button.
- **New or edit template dialog** (modal, about 520 px): a drop zone for the file (“Thả file Word (.docx) vào đây” or “Thả ảnh nền (PNG, JPG) vào đây”; after a file is chosen it shows the file name with a check); a name field (filled automatically from the file name); a group dropdown whose last option is “+ Thêm nhóm mới…” (which reveals a text box); a link “+ Thêm ghi chú” that reveals the note field; for document templates, a collapsed section “Tìm thấy n trường trong file. Xem tên hiển thị” that lists each tag key with an editable display label; buttons “Hủy” and “Lưu mẫu”. Saving an image template continues to the image editor; saving a document template returns to the list with the message “Đã lưu mẫu.” The duplicate-name warning appears under the name field.
- **Image editor** (sub-page, back link “‹ Mẫu”): left, the background image at its real proportions with draggable text boxes showing sample text (the first data row when data is loaded, otherwise the field label); a “+ Thêm chữ” button below. Right, an inspector for the selected box: Trường (text box for the field name, with its number shown beside it), Font (dropdown of installed families, with the note “Chỉ hiện font đã cài trên máy này.”), Cỡ chữ, Màu (color picker plus hex), Kiểu chữ (segmented: Thường, Đậm, Nghiêng, Đậm nghiêng; a style the font lacks is disabled), Căn lề (Trái, Giữa, Phải), and “Xóa khung chữ này”. There is no “Nâng cao” section and no preview in the editor (removed 2026-10-30): a new box keeps the default of one line that shrinks to fit, and the real result is seen in the mapping step. With no box selected the inspector says to select a box. Primary button “Lưu mẫu”. The editor has no undo or redo in the first version. The canvas always shows the real image regardless of theme.

**Screen 3: Cài đặt**

- Title “Cài đặt”, subtitle “Chỉ những gì thật sự cần.” Two groups separated by a line:
  - **Giao diện:** a segmented control “Sáng | Tối | Theo hệ thống”, applied immediately.
  - **Giới thiệu:** the version, the local-only line (“Chạy hoàn toàn trên máy này, không gửi dữ liệu đi đâu.”; the owner removed the MIT and third-party texts from the UI on 2026-10-29, the files still ship in `resources/`), the Electron end-of-support date, and a secondary button “Kiểm tra bản mới” that opens the download page in the default browser.

**Feedback and states**

- Short confirmations appear as a toast at the bottom center for about 2.5 seconds (for example “Đã lưu mẫu.”, “Đã xóa mẫu.”) and are announced to screen readers.
- Blocking problems (unreadable file, `.xls`, missing font) appear inline in the step where they occur, with the fix next to the message.
- Closing the window during an export asks for confirmation; closing at any other time does not, because nothing is unsaved (data is never stored).

**Accessibility**

- Full keyboard operation; logical focus order; visible focus; labels on all inputs; status is never shown by color alone (markers and text accompany the green, yellow, red, and gray states); the progress bar has a text equivalent; sufficient contrast in both themes.

## 6. Phased Roadmap

The project is divided into six phases. The first public release (MVP) will ship at the end of Phase 2. Later phases will proceed only when there is demonstrated demand.

[Embedded content: roadmap · six phases, tasks, and completion criteria]

## 7. Distribution and Code Signing

CI builds for all three operating systems, but only Windows and Ubuntu files will be attached to public releases. Every file attached to a release has a public URL, so “hiding macOS” means not attaching the macOS build. The macOS build will be kept only as a tagged workflow artifact for 1 day (`retention-days: 1`). The Free plan has a shared 500 MB artifact-storage limit; GitHub's documentation describes this quota for private repositories, so public repositories are likely not counted, but this is not confirmed. Check the Billing page after the first CI run.

| Platform | Distribution and signing | Notes |
| --- | --- | --- |
| Windows | Per-user NSIS installer (no administrator privileges required), distributed through GitHub Releases. The first release will be unsigned; apply to SignPath afterward (free for open-source projects). **Backup: if SignPath rejects the application, publish an MSIX build through the Microsoft Store.** | SignPath accepts projects that have already been released, have a description on the download page, and have a verifiable reputation. Each signed release requires manual approval. No approved single-maintainer project has been found; at least one single-maintainer project reported a rejection for insufficient public visibility and reputation. Unsigned builds: SmartScreen reputation is tracked per file, so every release starts from zero, and new unsigned NSIS installers are often flagged by Defender's machine-learning detection (false positive). Mitigations for every release: embed publisher and version information in the executable, do not use UPX, scan with VirusTotal before publishing, and submit false-positive reports to Microsoft. Microsoft Store backup: individual registration is free but requires identity verification (government ID and selfie); the Store re-signs MSIX packages. An unsigned MSIX cannot be installed outside the Store, so this is a Store-only channel, not a sideload option. Whether Vietnam is a supported market has not been verified. Only start registration if SignPath rejects the application. |
| Ubuntu | `.deb` is the primary package; AppImage is secondary. No signing required. | AppImage may have sandbox issues on Ubuntu 24.04 (requires `libfuse2t64`; `--no-sandbox` is a fallback). The `.deb` package avoids this issue. |
| macOS | Not publicly released yet; the download page says “Coming soon.” Test builds use ad hoc signing. | Builds that have not been notarized are blocked by Gatekeeper; users must go to Privacy & Security and select Open Anyway. Publish once notarization is available (Apple Developer Program: $99/year). |

- SignPath requirements: an OSI-approved license (MIT) and no closed-source components; a public repository; two-factor authentication for all members; Authors, Reviewers, and Approvers roles (a solo project holds all three); a “Code signing policy” page with an attribution statement; product name and version embedded in signed files; builds submitted through the GitHub runner using the `submit-signing-request` action; manual approval for each signed release; and an installer that supports uninstallation.
- Download page at `nhhthong.github.io/sheetstamp`: Windows and Ubuntu buttons point to `releases/latest/download/<fixed-filename>`; include Vietnamese installation instructions with screenshots and `SHA256SUMS.txt`.
- No automatic updates: users must download new versions manually. The Settings screen has a “Check for new version” button that only opens the download page in the default browser.

* Keep release artifact filenames fixed using `artifactName`. Do not mark version `0.x` as a pre-release: GitHub excludes pre-releases and drafts from `releases/latest` and from the `latest/download` redirect (verified). Create each release as a draft, upload all assets, then publish it in one step so the link never points to a release with missing files. Still test the download link in the first release.
* Repository setup tasks: enable two-factor authentication, add `LICENSE` (MIT), write a `README` describing the features, add a “Code signing policy” section, and include third-party license notices.

## 8. Key Risks

Risk levels are my own estimates and are not backed by measured data. They are ordered from high to low and show residual risk after the listed mitigation.

| Risk | Level | Mitigation |
| --- | --- | --- |
| Word splits placeholders across runs; complex templates (tables, headers, footers); tags with diacritics | High | Phase 0: test 10 self-created templates plus at least 5 real HR/accounting templates. Read the easy-template-x source for header/footer handling. Set a failure threshold before testing; if exceeded, add a preprocessing step that merges runs, or replace the library. Keep it behind a `TemplateEngine` interface. Require users to confirm mappings. |
| Windows signing: SmartScreen warnings, Defender false positives, SignPath rejection | High | First release unsigned with screenshot-based instructions and `SHA256SUMS.txt`; apply the per-release mitigations in section 7; apply to SignPath after the first release. Backup if rejected: Microsoft Store (MSIX). |
| Vietnamese data: wrong encoding detection; leading zeros lost in `.xlsx` | High | Encoding order and manual selector as described in section 5; read displayed cell text and offer zero padding; test with real files in Phase 0. |
| Vietnamese text renders incorrectly or loses diacritics in images | High | Test in Phase 0; normalize to NFC; provide sufficient line spacing; ensure “Preview” uses the actual rendering function. |
| MVP scope is large for one person | High | Accepted by the owner; no scope reduction planned. |
| Demand is not validated (Windows-first, “Mail Merge is cumbersome”) | High | Accepted by the owner; the assumption stays labeled as unvalidated in section 1. |
| `@napi-rs/canvas` native module in the background process and in the packaged app | Medium | Phase 0: run it in the chosen background process (worker or utility process), unpack the `.node` file from the ASAR, and test packaged builds on clean machines. |
| The chosen installed font lacks Vietnamese diacritics or a Bold/Italic face | Medium | List only installed fonts; the user confirms the result in Preview; one message if a saved font was uninstalled; Phase 0 tests on clean Windows and Ubuntu machines. |
| Image preview differs from export | Medium | react-konva only positions boxes; the preview bitmap comes from the Skia render function. |
| Poor performance with 4,000 rows on low-end hardware | Medium | Benchmark in Phase 0; use a worker pool by default, background processing, and streaming ZIP creation. |
| Electron becomes outdated (no LTS, about six months of support per major, no auto-update) | Medium | Upgrade every 3–4 months; use Renovate or Dependabot for Electron releases; state the end-of-support date of the shipped version on the download page; the Settings screen has a “Check for new version” button that opens the download page. |
| Golden-file tests are flaky across operating systems | Medium | Normalized XML comparison for Word; pixel threshold on one reference OS for images. |
| Filename edge cases (path length, case-insensitive duplicates, NFC/NFD, path characters) | Medium | Rules in section 5 plus a test for each case. |
| Renderer security (Electron hardening) | Medium | Hardening list in section 5; review before the first release. |
| Error report and temporary files leak personal data or enable formula injection | Medium | Error report has no source data and uses tab-prefixed cells; ZIP written to a temporary file and cleaned up on cancel or failure. |
| Non-ASCII filenames display incorrectly inside ZIP files | Low | Archiver marks UTF-8 (bit 11); test on Windows 10/11, macOS, and Ubuntu, including an NFD name. |
| AppImage fails on Ubuntu 24.04 | Low | `.deb` is the primary package; document installation on the download page. |
| macOS Gatekeeper blocks builds that have not been notarized | Low | Do not publish until notarization is complete. |
| Poorly maintained dependencies (`exceljs`, `electron-vite`) | Low | Keep them behind replaceable abstractions; run `npm audit` in CI; Electron Forge is the fallback. |
| GitHub `latest` link and artifact storage | Low | `latest` behavior verified (section 7); set `retention-days: 1`; check Billing after the first run. |

## 9. Open Questions and Phase 0 Verification

**Decisions made in this revision**

- Microsoft Store is the backup channel only if SignPath rejects the application.
- The MVP scope stays as is (accepted as large for one person).
- `.xls` is not supported.
- Demand validation is skipped.
- Electron has no LTS; upgrade every 3–4 months.
- A simple “Check for new version” button in Settings that only opens the download page; no background network calls.
- Settings contents as listed in section 5; there is no “delete all templates and profiles” action.
- App structure: Document templates, Image templates, and Settings, with a template library (create, read, update, delete) for each kind of template.
- Fonts: only fonts installed on the user's computer are listed and used. No bundled font, no adding font files inside the app.
- Home is the export flow: Data, then Template, then Mapping & preview, then Export. One template per export.
- The template picker shows type, group, and name as separate labels (not one concatenated string), and its search ignores diacritics.
- Every template has a name, exactly one group, and a note; the group list is shared by both kinds of templates (default groups: Hợp đồng, Nghỉ việc, Tài liệu khác).
- The filename pattern is saved with the template and reviewed at the Export step before every export.
- User interface: three sidebar destinations (Tạo file, Mẫu, Cài đặt); document and image templates share one Mẫu page with two tabs; Home shows one step at a time; mapping is a list that highlights only unmatched fields, shows the first row's value for each field, and lets each column serve one field; Settings keeps only theme and About; the output folder and the diacritics option are remembered instead of being settings; concatenation, value transformation and input-at-export are deferred beyond the MVP. Details in section 5.1.
- Storage: local JSON with atomic writes behind a `Storage` interface (`docs/adr/0001-json-storage.md`).
- No HR dictionary (owner's decision, 2026-10-29; replaces the draft in `data/hr-dictionary.json`, which is removed). Word tags are matched to columns by name; image fields are matched by position and named by the user as free text. Rejected: numbered tags `(1)`/`{{1}}` for Word, because HR documents already contain numbered clauses such as “(1)”; a user-editable dictionary screen; a first-run tutorial.
- Roadmap placement: Home flow for Word in Phase 1; image templates, theme, Settings, packaging and first release in Phase 2 (details in the project notes; the roadmap figure should be checked against this).
- Home steps are strictly sequential; minimum window 720×560 until tested on real machines.
- Vocabulary is defined in `GLOSSARY.md` (Template, Tag, Field, Column, Mapping, Batch).
- Section 9 UI assumptions confirmed (source-file copy, inline delete confirmation, font-uninstalled message, no undo/redo in v1, filename pattern saved back, diacritics checkbox off by default, confirm on closing during export).
- easy-template-x pass threshold: all 10 self-written templates and at least 4 of 5 real templates correct; otherwise add run merging before replacing the library.
- Provisional performance target for 4,000 rows on 4 cores: Word ≤ 60 s, images ≤ 120 s; final after the Phase 0 benchmark.
- Conventions: electron-vite layout plus `src/worker`, tests beside code, TypeScript strict, Biome defaults, npm, version 0.1.0, English for code and docs.

**Pending decision**

- None. The remaining unknowns are the items under “Not yet verified”.

**Phase 0 checklist**

- Create the `nhhthong/sheetstamp` repository: enable two-factor authentication, add `LICENSE` (MIT), write a feature-focused `README`, create a basic GitHub Pages site with a “Code signing policy” section, and add third-party license notices.
- Create 10 self-authored Word templates with mock CSV data, covering placeholders split across Word runs, tables, headers, footers, NFD-normalized names, tags with diacritics, and leading zeros. Add at least 5 real templates from HR or accounting staff.
- Test Skia rendering of Vietnamese combining diacritics, in Normal, Bold, Italic, and Bold Italic, on all three operating systems; verify that `@napi-rs/canvas` runs in the chosen background process and in a packaged build.
- Test fonts: a font installed in the operating system while the app is running (does it appear without a restart?), a saved template whose font has been uninstalled (one message, then choose another installed font), and clean Windows 10/11 and Ubuntu 22.04/24.04 installations (which installed families have Vietnamese diacritics and Bold/Italic faces).
- Test filenames containing diacritics inside ZIP archives by opening them with File Explorer (Windows 10 and 11), Archive Utility (macOS), and Ubuntu tools.
- Test CSV and `.xlsx` inputs: UTF-8 with and without BOM, Windows-1258, numeric ID columns formatted as `00000`, and a renamed `.xls` file.
- Benchmark processing of 4,000 rows for both Word and image outputs on a 4-core machine.
- Ad hoc-sign the macOS build on your Mac and record the actual warning message, including whether the Open Anyway button appears.
- Test installation on clean machines: Windows (per-user installation) and Ubuntu 22.04/24.04 (both `.deb` and AppImage). Scan the Windows installer with VirusTotal and note any Defender warning.
- Test `releases/latest/download/<fixed-filename>` with the first public release, created as a draft and then published.

**Verified**

- Electron 45: stable October 20, 2026; end of support April 27, 2027; support covers the latest three major versions; there is no LTS.
- GitHub excludes drafts and pre-releases from `releases/latest` and `latest/download`.

**Verified by prototype on Linux, Node 22 (2026-10-28, `prototypes/phase0/`)**

- easy-template-x 8.0.0 handles split runs, tables, headers, footers, tags with diacritics and loops. Tag keys match literally (normalize to NFC); a missing key silently becomes an empty string; the value takes the format of the tag's first run; about 4 ms per small document.
- exceljs `cell.text` ignores number formats. `ssf` formats Excel codes such as `00000` correctly.
- `chardet` is unreliable on short Windows-1258 text; the fixed order BOM, strict UTF-8, Windows-1258 makes it unnecessary.
- `@napi-rs/canvas` lists families with their styles (`GlobalFonts.families`), has no coverage API, synthesizes bold and italic when a face is missing, and renders Vietnamese diacritics inside a `worker_thread`.
- archiver 8.0.0 (API: `ZipArchive`) sets the UTF-8 flag for non-ASCII names.
- exceljs loads 50,000 rows in about 3 s and 280 MB.

**Verified in CI and benchmarks (2026-10-28)**

- `@napi-rs/canvas` 1.0.11 runs in `worker_thread` and `utilityProcess` inside the packaged app on Windows and Ubuntu with identical pixels; 1.0.12 and 1.0.13 crash Electron 45 on load (CI run 40720039038).
- A font installed while the app runs appears after `GlobalFonts.loadFontsFromDir` on Linux and Windows.
- 4,000 rows on 4 cores with 3 workers: Word about 11 s, images about 42 s, no failed row, main-thread lag about 15 ms (p99); `.work/proof/`.
- Packaged self-test passes on windows-latest, ubuntu-latest and macos-latest (Release run 40721739906).
- Non-ASCII ZIP names extract correctly with `unzip` and Python on Ubuntu and with `ditto` (Archive Utility's engine) and `unzip` on macOS (ZIP names run 1).
- Public-repository artifacts: 566 MB uploaded in one run without error.
- `easy-template-x` parses and fills tag names that contain spaces, diacritics, only digits, hyphens or parentheses (probe test, 2026-10-29).

**Not yet verified**

- Style availability and rendering of installed fonts on macOS; fonts installed at runtime on macOS.
- Display of non-ASCII ZIP names in Windows Explorer and Ubuntu's archive manager (command-line extraction is checked in CI).
- Whether SignPath approves a solo project (no approved example found; one rejection reported).
- Whether Vietnam is a supported market for individual Microsoft Store accounts.
- The Billing page reading for Actions storage (the API evidence says it does not count).
- The licence of the transitive dependency `buffers@0.1.1` (no license field; see `THIRD-PARTY-NOTICES.md`).
- The 5 real HR/accounting templates (a 12-document stand-in passes).
