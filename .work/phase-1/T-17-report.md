# T-17 report: template library (Word)

## What exists
- Page `src/renderer/pages/templates/TemplatesPage.tsx`: segmented control, "+ Mẫu mới", rows, inline delete, empty state, "Sắp có" notice on Ảnh. "Sửa" is a disabled button with a tooltip; T-18 only adds the handler.
- `NewTemplateDialog` (exported from `NewTemplateDialog.tsx` and re-exported by `TemplatesPage.tsx`), props `{ open, onOpenChange, onCreated(templateId) }`. It closes itself, shows "Đã lưu mẫu." and then calls `onCreated`. State resets on every opening (the form mounts only while open).
- Channels (`src/shared/ipc/templates.ts`): `templates:list`, `templates:get`, `templates:delete`, `templates:choose-file`, `templates:parse-file`, `templates:create`, `groups:list`, `groups:create`. Failures the user can fix come back as `{ ok: false, message }` (Vietnamese), not as exceptions.
- Library logic in `src/main/templates/library.ts` (testable without Electron); handlers in `src/main/ipc/templates.ts`.

## For other tickets
- `getStorage()` in `src/main/templates/store.ts`: lazily opens `SHEETSTAMP_DATA_DIR` or `<userData>/data` once, returns the same `Promise<Storage>` afterwards (a failed open is retried on the next call). `(await getStorage()).warnings` holds corrupt-file warnings; nothing shows them in the UI yet (open item for a shell or Settings ticket).
- `getTemplate` returns tags with labels (`{name, label}`) for T-18.
- `parse-file` returns tags with `kind` and suggested `label`; `create` re-reads the file in main, so tags never come from the renderer. Only labels do.

## Ambiguities
- Tag count: fields only (unsupported tags are not stored). Loop marks and footnote tags are warned about in the dialog.
- Unsupported kind shown as "vòng lặp" when raw starts with `{{#` or `{{/`, else "nằm trong chú thích cuối trang". The engine does not say which; footnotes, endnotes and comments are all described as notes.
- Native open dialog is the only way to pick a file in tests, so the e2e replaces `dialog.showOpenDialog` in main. Drop uses `pathForFile`; a synthetic drop in Playwright has no real path, so drop is not covered by e2e.
- Size limit 20 MB (`MAX_SOURCE_BYTES`), checked in main for both parse and create. Non-.docx and broken zip are refused with messages (tested).
- Duplicate-name check is done in the renderer against the list (case and diacritic-composition insensitive); it never blocks.
- New group is created at save time, not when typed, so cancelling leaves no stray group.
- List is sorted newest first. Date shown as `dd/mm/yyyy` (vi-VN) once a template has been used.

## Edit outside owned files
- `src/renderer/components/ui/dialog.tsx`: added `max-h-[calc(100vh-32px)] overflow-y-auto` to the popup. With a found-tags list the dialog was taller than the window and "Lưu mẫu" was unreachable (Playwright: "element is outside of the viewport").

## Evidence
- `npx biome check .` clean, `npm run typecheck` clean, `npx vitest run` green.
- `npm run build`, then `xvfb-run -a npx playwright test`: 4 passed (2 new): create from a split-run/loop/footnote docx (3 fields, 3 unsupported), edited label persists, new group, duplicate warning, restart with same data dir keeps the row and labels, inline delete (Giữ lại then Xóa) removes the stored copy; bad file messages.
- Screenshots (light and dark) written to `test-results/templates/` (empty, dialog, list, confirm) and viewed.

## Open items
- Storage warnings are not displayed.
- Dialog is tall when labels are expanded; it scrolls.
