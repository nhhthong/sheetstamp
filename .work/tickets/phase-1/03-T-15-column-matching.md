# T-15: Column matching

**Type:** task
**Parent:** E-1
**Requirements:** R2.1, R2.3, R2.4, R2.5
**Blocked by:** None (can start immediately)
**Status:** done
**New infrastructure:** fuse.js
**Files:** src/main/mapping, data/hr-dictionary.json, tests/fixtures/mapping
**Proof:** `npm test` passes the matching suite: exact without diacritics, synonyms, fuzzy, and the mapping profile recompute when columns change.
**Step:** 1 fixtures generator; 2 matcher; 3 profile and labels; 4 IPC; 5 threshold study; 6 bundle check
**Base:** b9d2b69
**Baseline:**

**What to build:** The logic that fills the mapping automatically. For each field of a template, find the column: exact match after removing diacritics against the tag key and its label, then the HR synonym list, then fuzzy matching (fuse.js, threshold tuned on the fixtures). A mapping profile says, for each field, a column, a fixed text or empty, and is recomputed when the data's columns change: it keeps choices that are still valid and reports fields that lost their column. The HR dictionary (display labels and synonyms) is compiled into the app bundle, not read from disk at run time.

- [ ] Matching tries exact, then synonyms, then fuzzy, and reports which rule matched.
- [ ] A column named "Họ và tên" matches the field ho_ten; "SĐT" matches so_dien_thoai; fixture tests show no wrong match among near-miss names.
- [ ] Changing the data file keeps valid choices and lists the fields that lost their column.
- [ ] A field with no column stays unmatched: it is never mapped by a weak guess below the threshold.
- [ ] The dictionary is part of the built bundle (test reads it from the built output).
- [ ] Label suggestion for a tag: dictionary entry, else underscores replaced by spaces with a capital first letter.

## Test plan (added by /dev:implement-ticket)

One suite, `src/main/mapping/mapping.test.ts`, over 94 generated fixture cases (positives with the expected rule, near misses that must stay unmatched), reconcile cases, dictionary sanity, IPC parse, and a check of `out/main` for the compiled dictionary; `threshold.test.ts` prints the threshold study.

## Result

All six criteria met. `npx vitest run` 165 passed, typecheck and biome clean. Details in `.work/phase-1/T-15-report.md`.
