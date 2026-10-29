# T-37: Match Word tags to columns by name, without the dictionary

**Type:** feature
**Parent:** E-3 (#20)
**Requirements:** R2.1, R2.5
**Blocked by:** None (can start immediately)
**Status:** in-review
**Tracker:** #21
**New infrastructure:** none
**Files:** src/main/mapping/dictionary.ts, src/main/mapping/match.ts, src/main/mapping/index.ts, src/main/mapping/mapping.test.ts, src/main/templates/library.ts, src/main/templates/image-editor.ts, src/main/template-engine/easy-template-x-engine.test.ts, README.md
**Proof:** `npm test` passes; a Word template with a tag `{{ho_ten}}` and a column "Họ tên" is matched by name, and a column "SĐT" is no longer matched to `{{so_dien_thoai}}` (it shows as unmatched).
**Step:** close
**Base:** d4eceac2eb745c4598ab038520ff08af7e8064c5
**Baseline:**

**What to build:** A Word template's fields are matched to columns by name only: exact after removing diacritics (against the tag and its label), then fuzzy. The synonym rule and the main-process dictionary are gone. A tag's display label is the tag with underscores as spaces and a capital first letter; the user can still edit it. Tag names made of spaces, digits, diacritics, hyphens or parentheses parse and fill (regression test from the 2026-10-29 probe). The image editor still uses `data/hr-dictionary.json` until T-39; this ticket leaves it in place.

- [x] Matching tries exact, then fuzzy; `MatchRule` no longer has `synonym`, and a column that was only a synonym ("SĐT" for `so_dien_thoai`) stays unmatched.
- [x] `suggestLabel("ho_ten")` returns "Ho ten"; no code in `src/main` imports `hr-dictionary.json`.
- [x] A test fills a template whose tags are `Họ và tên`, `1`, `a-b` and `ten(1)` and lists them in `parseTags`.
- [x] The existing mapping, rank, threshold and session tests pass after removing the synonym cases.
- [x] `README.md` no longer mentions the HR synonym list.

## Test plan (added by /dev:implement-ticket)
Tier light. Unit: `npm test` (mapping fixtures regenerated, new synonym-free case, tag-name test in the engine suite). End to end: the whole Playwright suite, because labels changed in three specs.

## Result
Goal: match Word tags to columns by name only, no dictionary in `src/main`.

Changed: removed `src/main/mapping/dictionary.ts` and the `synonym` rule (`MatchRule` is `exact | fuzzy`); `suggestLabel` moved to `label.ts` (underscores to spaces, capital first letter); fixtures: header variants that only a synonym found now expect no match (`none`); README line updated.

Proof: `npm test` 462 passed (50 files); `npx playwright test` 60 passed; `npx biome check src tests` and `tsc --noEmit` exit 0. Verdict: VERIFIED.

Consequence the owner should know: a column "Họ và tên" no longer matches `{{ho_ten}}` (its label is now "Ho ten") unless the user edits the label or names the tag to match. This follows the decision to drop the dictionary (D-1).

Decisions: "Mail" still fuzzy-matches `email` (one letter apart, five letters); kept.
Follow-ups: the image editor still uses `data/hr-dictionary.json` (T-39, #23).
Applied: test-plan (inline), skip: review: not run, the diff is a deletion plus test updates and both suites pass; skip: explore-why: no unfamiliar code.
