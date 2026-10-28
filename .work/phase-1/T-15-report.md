# T-15 report: column matching

## Ambiguities, options, choice

1. **Fuzzy threshold and options.** Swept Fuse `threshold` 0.1 to 0.45 on 94 generated cases (449 field checks), with and without a word-by-word confirmation of each Fuse hit (`threshold.test.ts`):
   - Fuse alone (`ignoreLocation: true`, on sorted-token normalized names): wrong picks at every threshold: 1 at 0.10 and 0.15, 5 at 0.25, 9 at 0.35, 14 at 0.45 (for example "Số điện thoại người thân" for so_dien_thoai, "Giới thiệu" for gioi_tinh, "Loại hợp đồng" for so_hop_dong). Fuse scores a pattern found inside a longer text, or with a few different words, too well.
   - Fuse plus confirmation (same token count; each word within 1 letter, 2 for words over 6 letters; compact forms within 2 edits and a length ratio of 0.85): 0 wrong at every threshold; 0.10 misses 3 typos, 0.15 to 0.45 miss none.
   - Chose **0.25** with the confirmation. It never maps wrongly and sits above the 0.15 edge, so a two-letter slip in a long name still matches. Other settings: `ignoreLocation: true`, `ignoreFieldNorm: true`, case-sensitive on already normalized text; candidates of 4 compact letters or fewer (abbreviations such as "sdt", "mnv") are never fuzzy; when the runner-up column is within 0.05 of the best the field stays unmatched.
2. **Word order.** Tokens sorted before comparing, so "Tên họ" finds ho_ten and "Sinh ngày" finds ngay_sinh (rule fuzzy).
3. **Key vs synonym.** Matching removes diacritics from the tag key as well, so "Ho ten", "Họ & tên" and "Thường trú" are `exact` for ho_ten and thuong_tru (the key normalizes to the same text). Synonyms are only what the key and label do not already cover.
4. **One column, two fields.** A column goes to one field only (best rule first, then score), so ten and ho_ten never both take "Họ và tên". Options: allow reuse (risk of silent wrong data) or unique. Chose unique; a user can still pick a column twice by hand in the UI.
5. **Dictionary cleanup.** The draft had `ten` claiming "họ tên"/"họ và tên"/"full name", and `dia_chi` claiming "địa chỉ thường trú" (the label of thuong_tru). Removed, and added synonyms (số điện thoại di động, sdt, mã số nhân viên, msnv, fullname, số căn cước công dân ...). A test now fails when a name belongs to two entries. 43 entries, extended not replaced.
6. **Profile model.** `{ version: 1, fields: { [tag]: {kind:"column",column} | {kind:"fixed",text} | {kind:"empty"} } }`. A field with no entry is unmatched. Auto matches are stored in it too, so valid choices survive a data change.
7. **Reconcile.** Keeps fixed/empty and still-present columns (also when only case, diacritics or punctuation changed, the current name is stored), drops tags no longer in the template, re-matches fields with no choice or a lost column (never offering a column the user already chose). Returns `{profile, lost[{field, previous, replacedBy}], filled, unmatched}`; `lost` lists every field that lost its column, even when a replacement was found, so the UI can tell the user.
8. **IPC.** `mapping:suggest` (fields, columns -> matches), plus `mapping:reconcile` and `mapping:labels` (tag keys -> suggested labels). All arguments validated with size limits.
9. **Bundle.** The dictionary is imported (`import raw from "../../../data/hr-dictionary.json"`), so it is inlined in `out/main`. The test reads `out/main/*.js` and expects entries from the file and no reference to the JSON path; it only warns and skips when `out/` does not exist (run `npm run build` first).

## Evidence
`npm run build`, then `npx vitest run`: 11 files, 165 tests passed (suite: 24 matching tests + threshold study). `npm run typecheck` and `npx biome check .` clean. Fixtures: `node --experimental-strip-types tests/fixtures/mapping/make-fixtures.ts` writes `cases.json`; a test checks the committed file equals the generator output.

## Open items
- The renderer must pass the template's current labels in `fields[].label`; without it only the key and the dictionary label are compared.
- Dictionary is still a draft: extend it from real templates.
- `out/` must exist for the bundle check to run in CI (build before test).
