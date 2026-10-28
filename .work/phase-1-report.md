# Phase 1 planning report

Planning on 2026-10-28 with `plan-tickets`, after the owner confirmed the roadmap placement (O-3).

1. **Epics.** The spec already divides the work into phases, so Phase 1 is the epic; no epic cutting (skill step 2). Tickets are cut for Phase 1 only.
2. **Open points.** No requirement of Phase 1 is marked ⚠️ or ❌ in the spec index, so no `spike` ticket is needed. One question changed the breakdown, how to show a Word document as pages (R9.4): settled before cutting by prototype (`prototypes/phase1`): docx-preview in the renderer over mammoth, which drops header, footer and page layout. It makes the preview a ticket of its own (T-14) that the mapping step (T-21) depends on.
3. **Two-way drafting.** Not run (subagents are not used unless asked). Instead the forward draft (from the Phase 0 code to the flow) was checked backward from each ticket's proof. That found five prerequisites a forward draft missed, now written into tickets: the HR dictionary must be compiled into the bundle (T-15), file paths in a sandboxed renderer come from the preload bridge (T-19), the OS folder picker (T-22), "open folder" and the close-window confirmation (T-23), and the data folder location (T-16).
4. **Order.** Riskiest first: the shell with new UI infrastructure (T-13), the preview (T-14, new dependency), matching (T-15, a threshold to tune on fixtures), storage (T-16). Routine UI steps follow.
5. **End-to-end proof is not a ticket.** The rule forbids "write the tests" tickets, so the full-flow Playwright test is the proof of T-23.
6. **Coverage gap on purpose.** R12.2 (the six design principles) has no ticket of its own: they apply to every UI ticket as acceptance rules. R8.x covers only the Word tab; the image tab and editor are Phase 2.
7. **Size.** Library, step 4 and the library edit were each split in two so that one ticket fits one session.
