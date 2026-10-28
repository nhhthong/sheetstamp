# T-21 report: Home step 3 (Ghép cột)

Base: d779fd0 (integration tip merged into the worktree).

## What exists
- `src/renderer/pages/home/`: `StepMapping.tsx` (load, list, footer), `mapping-field-row.tsx`, `mapping-preview.tsx`
  (pager + `WordPreview`), `mapping-values.ts` (+ test: row values through the mapping, "resolved" rule),
  `mapping-stale.ts` (session-long watcher). Strings: `src/renderer/strings/home-mapping.ts`.
- Main: `src/main/mapping/session.ts` (+ test; `openMapping`, `setMappingEntry`, `getMappingRow`, `templateBytes`),
  `src/main/mapping/shape.ts` (+ test; `toProfile`, `toRecord`). Channels added in `src/shared/ipc/mapping.ts`:
  `mapping:open`, `mapping:setEntry`, `mapping:row`, `mapping:templateBytes` (T-20's remain).
- `tests/e2e/home-mapping.spec.ts`.

## Profile shape (decided by the caller)
Storage keeps the flat `Record<tag, entry>`. `toProfile(stored)` wraps it for `reconcile`/`matchFields` (also accepts an
already wrapped value and drops invalid entries); `toRecord(profile)` gives the flat record to persist. T-18's
`src/main/templates/edit.ts` now uses the same helpers and always writes the flat record (the `wrapMapping` variant that
echoed the found shape is gone). Behaviour for flat input is unchanged; templates-edit e2e still green.

## Settled questions
1. **Empty mapped cell vs missing column.** Mapped cell is "" -> value "" (preview shows red "(trống)"). A column entry whose
   column is not in the data, a field with no entry, and a fixed text box still empty -> `unmapped` ("(thiếu)"). "Để trống" -> "".
   In practice main drops lost columns on entry, so "missing column" only shows for an unresolved field.
2. **Pager.** Arrows disabled at the ends; with 1 row both are disabled and it reads "Dòng 1/1". 0 rows cannot reach the step (data
   step refuses). With 50,000 rows there is no list: `mapping:row {index}` returns one row's cells (index validated 0..rows-1
   in main), so cost does not depend on the row count. No "go to row" box (open item).
3. **Speed.** Table and stored template stay in main; the renderer gets columns, row count, one row at a time. A mapping change
   needs no row fetch (row in hand, values recomputed, `preview:fill` only). Template bytes are fetched once on entering the step and
   passed to `WordPreview` (its contract takes bytes; resolving an id in main would have meant changing `src/main/preview`, not done).
   Measured in e2e, click on next row until the new text is in the preview: 99, 93, 83, 66 ms (limit 500).
4. **Debounce.** Preview fill is not debounced for dropdown changes. Fixed text: the box shows what you type at once; the mapping
   (preview + save) follows 250 ms after the last key and on blur. Fills are cancelled by `WordPreview` when stale. Saves are
   serialized in main (a queue), so quick changes do not overwrite each other.
5. **Unresolved rule.** "Nhập chữ cố định" with an empty box counts as unresolved (the user has not decided; "Để trống" is the way to leave
   empty). The entry is still stored as `{fixed, text: ""}`.
6. **Pinned rows.** Fields unmatched on entry stay in the top list after they are settled (marker "Đã chọn") so rows do not jump
   under the cursor. A matched field switched to "Chọn cột…" or empty fixed text turns highlighted in place and counts in the heading.
7. **Lost columns.** `reconcile.lost` is computed on entry and shown as a warning list (with the replacement if matching found
   one). It is shown once per entry: the new profile is saved at once, so a second entry shows nothing.
8. **Stale flow.** Step 3 is only mounted while active, so a module-level watcher (`mapping-stale.ts`, started from `StepMapping`)
   invalidates the mapping step when `revision.data` or `revision.template` changes after it was finished, and uses
   `flow.reopen("mapping")` then `flow.invalidate("mapping")` to bring the user back when `complete("data")` had moved on to
   step 4. No edit to `flow.ts` was needed.
9. **Labels.** Template labels are passed as `fields[].label` to matching (T-15's open item).
10. **Validation in main.** template id exists and is Word; key is a tag of the template; column is in the loaded table; fixed text
    at most 1000 characters; row index integer within range. Failures return `{ ok: false, message }` (Vietnamese).

## Outside owned files
- `src/main/templates/edit.ts` (T-18): uses `toProfile`/`toRecord`, flat only. Nothing in `src/main/preview`, `flow.ts`, `vi.ts`.

## Evidence
- `npx biome check .` clean, `npm run typecheck` clean, `npx vitest run`: 20 files, 220 tests passed.
- `npm run build`, `NODE_OPTIONS= xvfb-run -a npx playwright test`: 22 passed (3 new). The new ones prove: odd column "Vùng miền" leaves only "Nơi sinh"
  highlighted; fix by hand; five rows paged; empty CCCD cell shows red `.ss-empty` and no "(thiếu)"; Tiếp tục disabled until fixed;
  stored mapping equals the flat record; after restart with same template and data nothing to fix; changing the data keeps 2 choices and
  says "Trường ‘CCCD’ mất cột ‘CCCD’. Chọn cột khác."; empty choice survives a restart; fixed text previews and saves; narrow window (700 px) stacks.
- Screenshots in `test-results/home-mapping/` (unmatched, resolved, lost, fixed, narrow; light and dark), viewed.

## Open items
- No "go to row" input for large files (arrows only).
- Template bytes are resent from the renderer on every preview fill (about 20 KB here).
- Selecting the same column for two fields is allowed by hand.
