# T-20 report: Home step 2 (Mẫu)

## What exists
- `src/renderer/pages/home/StepTemplate.tsx` (body), `template-search.ts` (+ test): `fold`, `matchesQuery`, `compareTemplates`, `visibleTemplates`.
- `src/renderer/strings/home-template.ts`.
- Channels in `src/shared/ipc/mapping.ts`, handlers in `src/main/ipc/mapping.ts`: `mapping:rankTemplates` (counts per Word template against `getCurrentTable()` columns, `hasData`),
  `mapping:getGroupFilter` / `mapping:setGroupFilter` (storage choices `lastGroupFilter`; a group that no longer exists reads as null), `mapping:useTemplate` (checks the id and kind in main, `markUsed`, returns name and group name).
- `src/main/mapping/rank.ts` (+ test): `rankTemplates(templates, columns)` using `matchFields` with the template labels.
- `tests/e2e/home-template.spec.ts` (3 tests).

## Ambiguities, options, choices
1. **Diacritic-insensitive search.** `fold`: NFD, drop `\p{M}`, `đ/Đ` to `d` (they are letters, NFD does not split them), lowercase, collapse spaces. Precomposed and decomposed typing both work. Query words are ANDed (each must appear as a substring of name + group + note), so "viec ke" finds "Thử việc … kế toán". Punctuation is kept (unlike `normalize` of T-15, which is for column names).
2. **"x/y" with unsupported tags only.** Storage keeps fields only, so such a template has y = 0: the hint says "Chưa có trường nào, <last used>" instead of "Khớp 0/0". Unsupported tags never count in y.
3. **No data loaded.** Cannot happen (step locked), but `rankTemplates` returns `hasData: false` and zeros; the hint then says "N trường, <last used>" without "Khớp", and the order falls back to last used, then name.
4. **Order.** matched count desc, then last used desc (never used last), then name (vi). Count not ratio, per the brief.
5. **Chips.** "Tất cả", every stored group, plus "Chưa phân nhóm" only when a template is in it. The choice is stored on click (also for "Tất cả" = null).
6. **Selection.** Kept when the filter hides the row; dropped when the template no longer exists after a reload. Reopening step 2 pre-selects the earlier result.
7. **After creating** in the dialog the list reloads and the new template is selected. Ranking reloads when `revision.data` changes.
8. Channel names: choices and use-template live under `mapping:*` as the brief said (T-18 owns the templates channels).

## Evidence
- `npx biome check .` clean, `npm run typecheck` clean, `npx vitest run` 17 files, 204 passed.
- `npm run build`, `xvfb-run -a npx playwright test`: 15 passed. home-template: 3/3 order, "hop dong" finds the two Hợp đồng templates, "DINH KEM" finds one by note, chip remembered after restart, Tiếp tục disabled until selection, one selected at a time, summary "Hợp đồng thử việc (Hợp đồng)", used date shown, create inside step selects the new one.
- Screenshots `test-results/home-template/list-*.png`, `dialog-*.png` viewed in light and dark.

## Notes
- The e2e fixtures live under `test-results/` not the system temp: `home-data.spec.ts` scans `os.tmpdir()` for stray `.csv`, and specs run in parallel workers (my first version failed it).
- Only the ticket's own files plus the mapping stubs were touched; nothing in `templates/**`.

## Open items
- The group chips for many groups wrap; no overflow handling.
- Selected-row outline checked via `aria-pressed` in e2e, not in a screenshot.
