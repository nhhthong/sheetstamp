# T-16: Json storage

**Type:** task
**Parent:** E-1
**Requirements:** R10.4, R8.8
**Blocked by:** None (can start immediately)
**Status:** ready
**New infrastructure:** none
**Files:** src/main/storage, tests/storage
**Proof:** `npm test` passes the storage suite: round trip, crash during write leaves the old file readable, corrupt file moved aside.
**Step:**
**Base:**
**Baseline:**

**What to build:** Local storage as decided in ADR 0001: a `Storage` interface and a JSON-file implementation in the app's data folder, with atomic writes (temporary file then rename). It keeps templates (metadata, tag labels, filename pattern, group, note, last-used date), groups, mapping profiles and the remembered choices, and a copy of each template's source file. Files carry a schema version; an unreadable file is moved aside as `.bak` and the app starts with an empty store and a message.

- [ ] Writes are atomic: a simulated crash between temp write and rename leaves the previous data intact.
- [ ] A corrupt JSON file is renamed `.bak`, the app starts empty and says so.
- [ ] Template source files are copied into the data folder and read back byte for byte.
- [ ] Schema version is stored; an unknown newer version is refused, not overwritten.
- [ ] No imported CSV or Excel data is ever written (test scans the data folder after a run).

## Test plan (added by /dev:implement-ticket)

## Result
