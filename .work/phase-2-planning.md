# Phase 2 planning report

Planning on 2026-10-28 with `plan-tickets`. 13 tickets, T-24 to T-36, in `.work/tickets/phase-2/`; script `.work/handoff/tickets-phase-2.sh` (not run; the owner runs it). Lint: `check-tickets.mts` exit 0 for all 32 Phase 2 requirement codes.

1. **Epic.** The spec already divides the work into phases, so Phase 2 is the epic (E-2); no epic cutting.
2. **Two-way drafting.** The skill says to run it for an epic like this one (new dependency, stored data shape, packaging). Subagents were not spawned (not asked for); a forward draft (from the code as it is) was checked backward from each proof, as in Phase 1. The backward pass added: the render/font IPC both the editor and Step 3 need (T-26), a test font in the e2e build, notices for react-konva (T-29), an allow-listed "open download page" command (T-35), the app icon and exe metadata (T-27, none exist yet), the contrast test (T-34), and a packaged-build dry run. The comparison did not run with independent planners, so these gaps are the ones I found, not a guarantee.
3. **Order, riskiest first.** Two spikes (image limits with EXIF; the license of `buffers`), then the font/render IPC, packaging (nothing in `build/` yet), the library, the editor, Home and export, then theme, About and release readiness.
4. **Parallel.** T-24, T-25, T-26, T-27 and T-34 have no blockers.

## Open points found (new, product decisions)

- **O-15 Where do an image template's fields come from?** A Word file has tags to scan; an image has none. The spec says "Trường (dropdown of labels)" without a source. Recommendation (T-29): the HR dictionary labels plus "+ Trường mới…" typed by the user; the key is the NFC slug of the label. Alternative: only the columns of the loaded data (breaks editing without data). Needs the owner's confirmation.
- **O-16 Where is PNG or JPG chosen?** The spec says "export to PNG or JPEG" but Step 4 has no control. Recommendation (T-33): a PNG / JPG choice in Step 4, default the format of the background, remembered like the diacritics checkbox. Needs the owner's confirmation.
- **O-14 stays open** (spike T-25). Raw GitHub content was not reachable from this environment, so the license of `buffers@0.1.1` is still unconfirmed (npm shows no license field, repository `substack/node-buffers`).
- **Value-only decisions** left to spike T-24: size, pixel and EXIF limits for the background.

## Risks

| Risk | Ticket | Watch |
|---|---|---|
| react-konva under the CSP, with React 19 and Electron 45 | T-29 | first thing to run; fall back to plain canvas and DOM handles if it fails |
| Font list loaded in a worker, not main | T-26 | native code stays out of the main thread; packaged self-test must cover it |
| Fonts differ per runner | T-26, T-30, T-33 | e2e uses the bundled test font only in the e2e build |
| Large images with 4,000 rows | T-24, T-33 | M3 (120 s provisional) measured before the limits are final |
| T-30 is the biggest ticket | T-30 | split the preview and the missing-font message off if it does not fit one session |
| Owner-only steps gate the release | T-36 | Pages, 2FA, tag, SignPath application; Claude never publishes |
| Windows e2e is flaky | all | `workers: 1` and one retry on CI are in place; do not add tests that depend on timing |

## Not in Phase 2

R0.3 (real HR templates, owner), R13.3 and R13.4 (SignPath, Store; after the first release), macOS release, items listed under "Out of scope" in the spec index.
