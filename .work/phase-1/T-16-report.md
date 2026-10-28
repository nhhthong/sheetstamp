# T-16 report: JSON storage

## Choices
- Interface: `Storage` in `src/main/storage/types.ts`; factory `openStorage(folder, {rename?, migrations?, schemaVersion?, now?})`. Core has no Electron import; the caller passes `app.getPath("userData")`. No IPC added.
- Layout: three files, `templates.json`, `groups.json`, `choices.json`, plus `sources/<templateId>.<ext>`. Each file is `{schemaVersion, data}`. Why not one file: a corrupt choices file must not cost the templates; writes of remembered choices (frequent) stay tiny; each file is still replaced atomically. Why not one file per template: dozens of templates, so the list is read at once anyway.
- Mapping profile is stored inside its template (spec: it belongs to the template; delete removes it). It holds column headers and user-typed fixed text, never cell values.
- Groups: three defaults seeded on first run. "Chưa phân nhóm" is a virtual group (`UNGROUPED_ID`), not stored; deleting a group, or a groups file lost to corruption, moves templates there.
- Atomic write: temp `<file>.<uuid>.tmp` in the same folder, fsync, rename, folder fsync (best effort). Failed write removes its temp; stale `*.tmp` are swept on open and are never read (only exact file names are loaded).
- Concurrency: every mutation runs through one promise chain; state commits in memory only after the file write succeeded.
- Corrupt/unreadable/wrong-shape file: renamed `<name>.bak`, then `.bak.1`, `.bak.2`; store starts empty for that collection; `warnings[]` carries a Vietnamese message. If the rename fails, `openStorage` throws `io`.
- Newer schema: `openStorage` throws `StorageError("newer-schema")` before touching anything; file untouched. Older: migration chain per file (`migrations[file][fromVersion]`), old file copied to `<name>.v<N>.bak`, then rewritten. Missing step or invalid result counts as corrupt. Version 1 is current, so no real migrations yet.
- Source copy: `sources/<id>.<ext>` (extension sanitised, original name kept only in the record), copied via temp name then rename; removed again if the record write fails.
- Recorded `imageLayout` as opaque `unknown` for the image-template ticket.

## Evidence
`npx biome check .` clean, `npm run typecheck` clean, `npx vitest run` 152 passed (16 new), 3 skipped (pre-existing).

## Open items
- `.work` is tracked in this repo's git despite the workflow note; I committed this report and ticket as the brief says.
- Renderer-facing channels (templates, groups, choices) are for the library tickets.
- Multi-process access to the same folder is not guarded (one app instance assumed).
