# Review fix: data integrity, messaging, renderer

Each finding was reproduced on the old code (vitest or Playwright red), then fixed (green).

## Findings

- 2 Replace loses the old file: `updateTemplate(id, patch, source?)` is now one storage mutation. The new copy is `sources/<id>-<uuid>.docx`, the JSON is committed, then the old file is deleted; a failed commit removes the new copy and keeps the old record and file. `replaceSource` is gone. Proof: `tests/storage/integrity.test.ts` (injected failing `rename`, second rename = JSON commit; old file bytes, tags and sources folder unchanged), plus the same through `templates/edit.ts`. Old code: file bytes differed after the failed replace.
- 5 Group races: unique/reserved/empty/not-found checks and the `moved` count run inside the storage queue (`StorageError` codes `invalid`, `reserved`, `duplicate`, `not-found`); `edit.ts` only maps codes to Vietnamese messages. `deleteGroup` returns `{moved}`. Proof: concurrent creates of "Hop dong x" / "hop dong X" / " HOP DONG x " leave one group; concurrent deletes give one `moved: 1` and one "Nhóm không tồn tại" (old code: 2 groups, wrong message).
- 6 Mapping queue: `storage.patchMapping(id, (mapping, template) => mapping | null)` inside the storage queue; `openMapping` and `setMappingEntry` use it (own queue removed). The edit flow no longer sends a mapping unless the file is replaced, and then computes tags/mapping from the freshest record (`updateTemplate` accepts a patch function). Proof: a gated edit started before a mapping save does not overwrite it (old code: mapping `{}`); concurrent entry saves plus `updateTemplate` keep both.
- 7 TOCTOU: `createTemplate({ source: { bytes, fileName } })` and `updateTemplate(..., source)` take the bytes already read and checked; no path is read by storage any more. Test: file swapped on disk after the read, the stored copy is the checked bytes; a hostile file name cannot move the copy. `.docx`/`.csv`/`.xlsx` restriction of renderer paths unchanged.
- 11 Validation: `isTemplate` checks tag entries (`{name,label}`; the stored shape uses `name`, not `key`), every mapping entry, `lastUsedAt`, and `sourceCopy` against `^sources/(?!\.\.?$)[^/\\]+$`. An invalid single record is skipped per record (`Collection.checkItem`, also for groups): original copied to `templates.json.bak[.n]`, file rewritten without the bad records, warning `invalid-record` with a Vietnamese message. Proof: 4 kinds of bad records skipped, the valid one stays, `listTemplates`/`getTemplate` of the library work, the next open is clean.
- 4 Status reaches the UI: channel `storage:status` (`src/shared/ipc/storage.ts`, handler `src/main/ipc/storage.ts`, `storageStatus()` in `templates/store.ts`) returns warnings and, when opening failed, `{code, message}`. `StorageBanner` + `useStorageStatus` show it on the Mẫu page and at the top of Home step 2; on an open failure the list, "Mẫu mới", "Quản lý nhóm" and "Tiếp tục" are not offered. Nothing destructive is offered. Proof: `tests/e2e/templates-storage.spec.ts`: corrupt `templates.json` becomes `.bak` (content equal, only one .bak), empty library, banner on both screens; newer schema (99): banner, buttons disabled, no list, `templates.json` byte-identical, no `.bak`, `groups.json` not created. Screenshots in `test-results/templates-storage/`.
- 8 StepData: request counter (`latest`) ignores stale `refresh` results and a command also invalidates refreshes that started before or during it; `refresh` has a catch that shows the inline message. Proof: e2e stubs `data:current` to reject then fires focus: old code, no alert (red); new code, `alert` shown and the drop zone stays usable.
- 10 Accessibility: `Status` danger/warning use `role="alert"`, info/success `role="status"`; `Dialog` has `hideCancel` (Groups dialog shows only "Xong"); after a group delete, focus goes to the first remaining row's first button (or "Xong" if none). Proof in `templates-edit.spec.ts`: no "Hủy" in the Groups dialog, duplicate-name error found by role `alert`, focus assertion after delete.

## Ambiguities

- Tag shape: the task says `{key,label}`; the stored `TemplateTag` is `{name,label}`. Validated what is stored.
- Focus after delete: first try was the list itself (`tabindex=-1`); Base UI gave focus straight back to the dialog popup (seen with a focusin log), so a real button is the target.
- The newer-schema state: `getStorage()` rejects on every call (it retries); there is no read-only open mode. "Not writable" therefore means the library is not usable at all until the app is updated, which is the safest reading of "never overwrite".
- Test API change: `NewTemplate.sourcePath` became `source`; the three e2e specs and `session.test.ts` that seeded through storage use `tests/e2e/file-of.ts` or an inline read.

## Not covered

- No renderer unit tests for the stale-result counter (only the rejection path is proven in e2e); the race itself is by construction.
