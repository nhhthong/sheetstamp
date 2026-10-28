# Review round 2 fixes: export step and whole flow

Each finding was reproduced (or measured) before the fix; tests named below.

1. Write error hang (BLOCKER). Reproduced: `zip.test.ts` "a real full disk..." on a 1 MB tmpfs (mounted by the test; skipped with a console message where `mount` is refused) timed out at 20 s before the fix. Fix in `src/main/export/zip.ts`: `Promise.race([added, finished])`, a captured write error checked every loop, `finalize` raced too, the catch block removes the temp file and waits for the stream close with a 5 s bound. `createOutput` option (tests inject a failing `Writable`; also tests cancel after an error). `session.running` is reset in `finally` (existing test "maps a disk problem"). `guardClose` waits at most 10 s for `settled()`.
2. Long ZIP name. `zipNameFor` caps the base at 100 characters and 200 UTF-8 bytes, cut at grapheme boundaries (`truncate` got a byte limit), date kept. `zip.ts` removes the temp file when the final step fails (test: ENAMETOOLONG leaves nothing) and a failed report write returns `reportFailed: true` (`ExportDone.reportFailed`, done screen text "Không ghi được báo cáo lỗi, nhưng file ZIP đã xong.").
3. Quadratic names. Measured before: 4,000 identical names 1.7 s here. `planFileNames` keeps the next number per base (Map); `truncate` skips the segmenter when text is short. Tests: same output as the old code for a mixed small case (output taken from the old code), 4,000 and 20,000 under 1 s.
4. Overwrite on case/NFC-insensitive file systems. `publish()` compares `key()` with all `readdir` names, then `link(temp, final)` (EEXIST: next number) and unlinks the temp; `rename` only where link is unsupported (EPERM/ENOTSUP/EOPNOTSUPP/ENOSYS), documented in the code. The report is created with flag `wx`. Tests: case, NFD vs NFC, a file that appears during the export.
5. Reserved names, bidi, zero-width, leading dot: `sanitizeName` tests the part before the first dot, strips the characters, turns leading dots into `_`. Tests in `filename.test.ts`.
6. `invalid-value`: new `RowErrorCode`; `buildRows` marks the row `invalid`, `runBatch` fails it as `invalid-value` without a worker. Done screen shows a hint with the count (`invalid-value-hint`). e2e `flow.spec.ts` expects `5,invalid-value` and the hint; the report holds no data.
7. Accessibility: `Status` got `alert` and `focusOnMount` props (focusable `tabIndex=-1` paragraph). The cancel notice is an alert and takes focus, the failure notice (already an alert) takes focus. e2e: `notice` is focused after "Hủy".
8. Draft: `removeDiacritics` restored; the draft carries a `version` (saved pattern and field keys of the template record); a draft for another version is dropped (`exportRun.resume`). Unit test `export-run.test.ts`.
9. Layering: `mapping-values` moved to `src/shared/mapping/values.ts` (with its test); the close-dialog text moved to `src/shared/messages/export.ts`; main no longer imports from the renderer.
10. One `stripDiacritics` in `src/shared/text/diacritics.ts` (tests: đ/Đ, NFC/NFD, loose marks, case kept); the five copies are thin wrappers (lowercase, collapse spaces) or direct uses; behaviour is the same for each (they lowercased anyway, so the Đ/D difference vanishes). Removed `throttle().flush` (and its test), un-exported `PROGRESS_INTERVAL_MS`, `EXTENSION`, `FAILURE_CODES` (used only inside their files), removed `homeExport.summary` and `homeExport.done.summary` (grep showed no users).
11. README: status and features reflect Phase 1 (image templates, theme, Settings, installers later), develop section states the display and `env -u NODE_OPTIONS xvfb-run -a npm run test:e2e`.
12. Sweep: `sweepStaleTemps(folder)` in `zip.ts` removes `.sheetstamp-<pid>-<ms>.tmp` regular files older than one day; called when the export step opens (`ExportSession.open`). Tests: fake old and fresh temp files and other files, in `zip.test.ts` and `export-session.test.ts`.

## Checks
biome clean, typecheck clean, vitest 25 files passed (3 runs, 297 tests), `env -u NODE_OPTIONS xvfb-run -a npm run test:e2e` 36 passed.

## Open items
- `guardClose`'s bounded wait is not covered by a test (needs Electron's dialog); it is a `Promise.race` with a timer.
- The tmpfs test needs root and `mount`; elsewhere it prints a skip message and the injected-stream tests cover the logic.
