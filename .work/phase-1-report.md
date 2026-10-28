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
