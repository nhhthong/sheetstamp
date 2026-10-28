# Phase 1 planning report

Planning on 2026-10-28 with `plan-tickets`, after the owner confirmed the roadmap placement (O-3).

1. **Epics.** The spec already divides the work into phases, so Phase 1 is the epic; no epic cutting (skill step 2). Tickets are cut for Phase 1 only.
2. **Open points.** No requirement of Phase 1 is marked ⚠️ or ❌ in the spec index, so no `spike` ticket is needed. One question changed the breakdown, how to show a Word document as pages (R9.4): settled before cutting by prototype (`prototypes/phase1`): docx-preview in the renderer over mammoth, which drops header, footer and page layout. It makes the preview a ticket of its own (T-14) that the mapping step (T-21) depends on.
3. **Two-way drafting.** Not run (subagents are not used unless asked). Instead the forward draft (from the Phase 0 code to the flow) was checked backward from each ticket's proof. That found five prerequisites a forward draft missed, now written into tickets: the HR dictionary must be compiled into the bundle (T-15), file paths in a sandboxed renderer come from the preload bridge (T-19), the OS folder picker (T-22), "open folder" and the close-window confirmation (T-23), and the data folder location (T-16).
4. **Order.** Riskiest first: the shell with new UI infrastructure (T-13), the preview (T-14, new dependency), matching (T-15, a threshold to tune on fixtures), storage (T-16). Routine UI steps follow.
5. **End-to-end proof is not a ticket.** The rule forbids "write the tests" tickets, so the full-flow Playwright test is the proof of T-23.
6. **Coverage gap on purpose.** R12.2 (the six design principles) has no ticket of its own: they apply to every UI ticket as acceptance rules. R8.x covers only the Word tab; the image tab and editor are Phase 2.
7. **Size.** Library, step 4 and the library edit were each split in two so that one ticket fits one session.

## Implementation (goal of 2026-10-28: all of Phase 1 on one branch and one pull request)

Rules given by the owner: auto-approve decisions already analysed by prototype; sub-agents may run in parallel; one integration branch and one PR; workflows off until the PR exists.

### T-13 App shell and IPC

1. **Parallel work needs a layout that does not collide.** Several tickets add IPC commands and pages at once. Options: one shared IPC file (every ticket edits it, so merges conflict) or one module per feature. Chose per-feature modules created empty up front (`src/shared/ipc/<feature>.ts`, `src/main/ipc/<feature>.ts`), each owned by its ticket, with a registry that lists the modules once. The page folders (`src/renderer/pages/<page>`) are owned the same way.
2. **IPC style.** A generic `invoke(channel, request)` bridge with an allow-list from the registry, instead of one preload function per command, so adding a command touches no preload code. The argument of every call is validated in main by the channel's `parse`; calls from a frame that is not the app's are refused. Tested in the e2e (unknown channel and bad argument are rejected).
3. **shadcn/ui (Base UI) as the spec says, but no generator.** The shadcn command line needs network and prompts; the spec only asks for the component source to live in the repo. Wrote Button, Input, Select, Dialog (on `@base-ui/react`), Toast and Status by hand with the same conventions (class-variance-authority, tailwind-merge). **Select is a native `<select>`**: fully accessible and keyboard friendly today; a Base UI select can replace it if the design needs one.
4. **Toast** is a small polite live region (about 2.5 s), not a library, because Base UI's toast manager adds more than one message needs.
5. **Theme.** The tokens (light and dark) exist now and dark follows the system; the user's choice (Sáng, Tối, Theo hệ thống) is Phase 2 and only has to set `data-theme` on `<html>`.
6. **Licenses of bundled development dependencies.** The renderer bundle contains the code of React, Base UI and others although they are development dependencies, so `THIRD-PARTY-NOTICES.md` would have missed them. `package.json` now lists them under `sheetstamp.bundledDevDependencies` and the notices script includes them and their dependencies (253 packages).
7. **Biome and Tailwind.** Biome needs `css.parser.tailwindDirectives` to read Tailwind's `@theme`; set.
8. **Checked by eye.** Screenshots of the shell in light and dark were looked at (sidebar, current item, heading, subtitle).

### How the work was run

One integration branch (`claude/project-guidance-y63vpi`), one pull request. T-13 was built directly; T-14, T-15, T-16, T-19 ran in parallel sub-agents (own worktrees), then T-17, then T-18 and T-20 in parallel, T-21, then T-22 and T-23 in one agent. Every report was re-verified by running the ticket's proof in the agent's worktree before merging (lint, typecheck, unit tests, built-app e2e). A reviewer sub-agent read T-13 to T-21 and found 1 blocker, 4 important and 7 minor issues; two fix agents repaired them in parallel; a second reviewer then read the export step and the whole flow (results below). Detailed per-ticket ambiguity lists are in `.work/phase-1/T-<n>-report.md`.

### Ambiguities and choices by ticket (short form)

| Ticket | Ambiguity | Choice and reason |
|---|---|---|
| T-13 | How to keep parallel tickets from colliding on IPC and pages | One module per feature, created empty up front, registry lists modules once; generic allow-listed bridge; every argument validated in main |
| T-13 | shadcn generator needs network and prompts | Components written by hand with the same conventions; native `<select>` |
| T-13 | Licences of dev dependencies that end up in the renderer bundle | `bundledDevDependencies` list feeds the notices script (255 packages) |
| T-14 | Unmapped tag versus empty value in the preview | Marker U+E002 + key → "(thiếu)"; empty value → "(trống)"; engine's own `missing` path not used |
| T-14 | Fonts and images inside docx-preview under the CSP | `ignoreFonts`, base64 images; preview uses system fonts so line breaks can differ a little from Word |
| T-15 | Fuzzy threshold | Swept 0.10-0.45 on 94 generated cases: Fuse alone maps wrongly at every threshold; Fuse 0.25 plus a word-by-word check never does. Chose 0.25 with the check; abbreviations of 4 letters or fewer are never fuzzy; ties leave the field unmatched |
| T-15 | One column for two fields | One column goes to one field only (user can still pick twice by hand) |
| T-15 | Dictionary conflicts | `ten` and `dia_chi` lost synonyms that belonged to `ho_ten` and `thuong_tru`; a test fails if a name belongs to two entries |
| T-16 | One file or several | Three files plus `sources/`: a corrupt choices file must not cost the templates |
| T-16 | Corrupt or newer-schema file | Corrupt: renamed `.bak`, start empty, warning; newer: refuse and never overwrite |
| T-17 | Which tags count in "n trường" | Fields only; unsupported tags (loops, footnotes) are listed in the dialog but not stored |
| T-17 | Tags on save | Main re-parses the file; the renderer sends labels only |
| T-18 | Renamed tag: rename or remove plus add | Remove plus add (the file has no tag identity); the dialog says so before saving |
| T-18 | Mapping profile shape (flat record in storage, wrapper in the matching module) | Flat record persisted; wrapper only inside `src/main/mapping` (decided by me, built in T-21) |
| T-19 | Padding an ID column | Default width guessed from the header (CCCD 12, CMND 9, phone 10); the warning is replaced by a confirmation |
| T-19 | Same file dropped again / changed on disk | Drop re-reads from scratch; Reload keeps encoding and sheet; size and mtime checked on focus |
| T-20 | Search with đ and combining marks | NFD, strip marks, đ to d, lowercase; query words ANDed |
| T-20 | Template with unsupported tags only | y = 0, hint "Chưa có trường nào" instead of "Khớp 0/0" |
| T-21 | Empty cell versus missing column | Empty cell = "" shown "(trống)"; no entry, unfinished fixed text, or a column not in the data = unmapped "(thiếu)" |
| T-21 | Fixed text box left empty | Not resolved; "Để trống" is the way to leave a field empty |
| T-21 | Invalidating step 3 when earlier steps finish again | Session-long watcher invalidates and reopens the step |
| T-22 | Where the example file name comes from | Main (`export:example`) from the real first row; the page never builds names |
| T-22 | Invalid pattern | Editor stays open, primary button disabled with a message; main refuses too |
| T-23 | Row with an XML-invalid control character in a value | The engine writes it as is, which Word calls corrupt; the row is reported as `missing-tag` instead of exported |
| T-23 | Progress events for 4,000 rows | At most one per 100 ms; `role="progressbar"` with text value and a live region every 10% |
| T-23 | Close during export | `win.on("close")` guard with a native confirmation; "Hủy và đóng" cancels, waits for the temp file to go, closes |
| Review | Navigating the window to a local file gave it the bridge | Exact page URL in one shared helper for navigation and IPC; dragover/drop cancelled outside zones |
| Review | Zip bomb | Central-directory limits (50 MB a part, 100 MB total, 10,000 entries, no zip64) before any inflate; `maxOutputLength` per entry |
| Review | Replace-file overwrote the stored copy before the record was committed | New unique copy name, commit, then delete the old file; one storage mutation for source, tags and mapping |
| Review | Group and mapping races outside the storage queue | Checks and `patchMapping` moved inside the queue |
| Review | Storage warnings never reached the UI | `storage:status` channel and a banner on Mẫu and Home step 2 |
| Review | Demo page shipped in production | Built only with `--mode e2e` (`npm run build:e2e`) |
| Me | Group dialog focus after delete was racy (passed in one run, failed in another) | Real race, not only the test environment: focus now set two frames after the parent reload; 5 of 5 runs pass |
