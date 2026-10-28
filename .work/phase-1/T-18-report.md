# T-18 report: template library edit

## What exists
- `EditTemplateDialog` (Sửa button wired), `GroupsDialog` (button "Quản lý nhóm" on the Mẫu page), logic in `src/main/templates/edit.ts`.
- New channels: `templates:replace-preview`, `templates:update`, `templates:check-pattern`, `groups:rename`, `groups:delete`. `templates:get` now also returns `filenamePattern`. `groups:create` now goes through the same name check (unique ignoring case, not the reserved "Chưa phân nhóm").

## Ambiguities, options, choice
1. **Mapping profile shape.** Storage holds `Record<string, MappingEntry>`; `src/main/mapping` uses `{version, fields}`. Edit accepts both and writes back the shape it found (`mappingFields`/`wrapMapping`). T-20 should decide one; nothing else changes.
2. **Reconcile has no data columns when editing a template.** Options: pass no columns (every column choice counts as lost), or pass the columns named in the profile. Chose the latter, restricted to tags that stay: kept tags keep column/fixed/empty, removed tags lose their entry, new tags are unmatched (no auto-match, so a column freed by a removed tag is not silently given to a new tag).
3. **Rename of a tag is a removed plus an added tag** (the file has no identity for tags). The summary says so in plain terms before saving.
4. **Removed tags are dropped from the template on save** (flagged only inside the dialog, label field disabled). The pattern may not use them: inline message, and main refuses.
5. **Atomicity.** `updateTemplate` first, then `replaceSource`; if the copy fails the old record is restored. Unreadable or bad file: refused in `replace-preview` (dialog shows why, nothing selected) and again in `templates:update` (tested through the channel), before any write.
6. **Pattern check** is advisory in the renderer (`check-pattern`, keys from main's data) and enforced in main against the real tags with `validatePattern`.
7. Group name uniqueness ignores case (NFC, locale lower case), not diacritics. Deleting asks inline with the number of templates that move.

## Edit outside owned files
- `tests/e2e/templates.spec.ts`: the "Sửa" assertion `toBeDisabled` became `toBeEnabled` (button is live now).

## Evidence
- `npx biome check .` clean, `npm run typecheck` clean, `npx vitest run` 198 passed.
- `npm run build`, then `NODE_OPTIONS= xvfb-run -a npx playwright test tests/e2e/templates-edit.spec.ts tests/e2e/templates.spec.ts`: 6 passed (4 new).
- Screenshots in `test-results/templates-edit/` (replace, edit, groups, groups-confirm; light and dark), viewed.

## Open items
- The dialog scrolls at small window heights (as the create dialog does).
- Image templates are not editable yet (Ảnh tab is a notice).
- No unit tests for `edit.ts` apart from e2e.
