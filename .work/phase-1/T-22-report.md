# T-22 report: Home step 4, options (Xuất file, first half)

Base: 7304f19 (the integration tip `claude/project-guidance-y63vpi` merged into the worktree).

## What exists
- Renderer: `src/renderer/pages/home/StepExport.tsx` (summary lines, folder, primary button), `export-editor.tsx` (chips, "Thêm:", "Thêm chữ",
  checkbox, "Lưu mẫu tên này vào mẫu", inline problems), `export-pattern.ts` (+ test: the `{{key}}` string as chips and back),
  strings in `src/renderer/strings/home-export.ts`.
- IPC (`src/shared/ipc/export.ts`, handlers `src/main/ipc/export.ts`): `export:open`, `export:example`, `export:pickFolder`,
  `export:setDiacritics`, `export:savePattern`. Failures are codes (`FailureCode`), the renderer words them.
- Main logic `src/main/export-session/` (`session.ts`: `ExportSession.open/example/savePattern/folder/rememberFolder`, `zipNameFor`,
  `effectivePattern`; `rows.ts`: `buildRows`), unit tests next to it.
- E2E `tests/e2e/home-export.spec.ts` (3 tests) and the shared helpers `tests/e2e/export-support.ts` (a file I added besides the two specs
  named in the brief: generated fixtures and the Home flow up to step 4, reused by T-23's `flow.spec.ts`).

## Decisions
1. **Where the names come from.** The renderer never builds a name. `export:example` runs `validatePattern` and, with no problem,
   `planFileNames` on the first row (same planner and same `maxLength` as the export, `.docx`), so the example is what the ZIP will hold
   (the " (2)" suffix for duplicates needs the other rows and does not show). The call is repeated on every chip/option change; the newest answer wins.
2. **Row values for the example** come from `rowValues` (the function the Step 3 preview uses) through `buildRows` in main, from the stored mapping
   of the template, not from anything the page sends. The renderer sends the pattern and the option only.
3. **Default pattern.** `{{ten}}` is the stored default. `effectivePattern`: when the stored value is that default and the template has no field `ten`,
   the pattern is the first field (`{{ho_ten}}`); no fields gives "" (then the "empty" problem shows). It is not written to storage until the user
   clicks "Lưu mẫu tên này vào mẫu".
4. **Problems.** `validatePattern` kinds go to the renderer as data (`empty`, `path-characters` with the text, `unknown-field` with the key) and are
   worded in `strings/home-export.ts`. With a problem: the example reads "(chưa có tên)", the editor opens by itself and stays open
   (also when the first problem is fixed in the middle of editing), "Xong" and "Lưu mẫu tên này vào mẫu" are disabled, and the primary button
   stays visible but **disabled**, with the text "Sửa tên file trước khi xuất." next to it and `aria-describedby`. (It keeps its label
   "Xuất <n> file"; hiding it would move the layout and removing the label would leave a button nobody understands.)
5. **Chips are a view of the string.** The editing state is a list of parts (so two fixed-text chips stay two while editing); the string with `{{key}}`
   tags is joined from them. A fixed text that itself contains `{{x}}` is read as a field when saved and reloaded (and is a problem if `x` is unknown).
   A field chip shows the label (key if the field is unknown); fixed text shows as typed. Kind is in the accessible text ("Trường …", "Chữ cố định …"), not only blue/neutral.
6. **Fixed text box.** "Thêm chữ" adds on Enter or "Thêm". Text is kept as typed (spaces included), no trimming; the filename rules sanitize later.
7. **Diacritics option.** Stored at once in the storage choices (`removeDiacritics`, default false) through `export:setDiacritics`. The remembered pattern
   is only changed by "Lưu mẫu tên này vào mẫu" (validated again in main; an invalid pattern is refused with `invalid-pattern`).
8. **Folder.** `dialog.showOpenDialog` in main with `openDirectory` and `createDirectory`, `defaultPath` = the folder in use. A chosen path is checked to be an existing
   directory and remembered at once (`lastOutputFolder`). Default when nothing is remembered or the folder is gone: `app.getPath("documents")` (not remembered until a choice or an export).
9. **The draft survives leaving the step.** The pattern being edited is kept in a module variable (like the flow store); it is gone after a restart, like the data.
10. **Primary button in T-22.** It is drawn, counts the rows and follows the problems, but has no action yet ("Nothing is exported yet"); T-23 wires it.

## Outside owned files
- None changed. (`src/shared/ipc/registry.ts` already lists the export module; `src/renderer/pages/home/HomePage.tsx` already renders `StepExport`.)
- `src/main/export-session/rows.ts` imports `rowValues` from `src/renderer/pages/home/mapping-values.ts` (pure module, no React) so main and the preview share one function.

## Evidence
- `npx biome check .` clean, `npm run typecheck` clean, `npx vitest run`: 22 files, 239 tests passed.
- `npm run build`, then `NODE_OPTIONS= xvfb-run -a npx playwright test tests/e2e/home-export.spec.ts`: 3 passed. They prove: the example for the first row ("Nguyễn Văn An.docx"),
  one "+ field" button per field, fixed text with Enter, the live example with "_Thử việc" and with "Bỏ dấu" ("Nguyen Van An_Thu viec.docx"), `/`, `\`, `..` and the empty pattern shown inline
  with the primary button and "Xong" disabled, the stored pattern is saved into the template (`{{chuc_vu}}_{{ho_ten}}`), the folder picker is called with `openDirectory` + `createDirectory`,
  and after an app restart the folder, the checkbox and the pattern are back and the picker opens at that folder (`defaultPath`); a stored pattern with an unknown field opens the editor with the message.
- Screenshots (light and dark) viewed: `test-results/home-export/problem-*.png`, `editor-*.png`, `test-results/flow/editor-*.png`.
- A full `playwright test` run had one failure in `home-data.spec.ts` ("nothing is left on disk"): it scans the shared `/tmp` and found `.csv` files of other agents' specs (`/tmp/sheetstamp-e2e-storage-*/nv.csv`) running in sibling worktrees at the same time. My fixtures are under `test-results/`. It passes when nothing else writes to `/tmp`.

## Open items
- The example does not show the " (2)" suffix for a name that repeats (it is the first row's name only).
- `Lưu vào` shows the full path; a very long one wraps (break-all), with no middle ellipsis.
- The documents-folder default is not remembered until used.
