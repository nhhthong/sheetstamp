# Handoff: Sheetstamp after v0.2.0 and PR #45 (2026-10-30)

Owner: nhhthong. **Writes Vietnamese, wants few words, answer first, verified facts, no invention.** Repo: `nhhthong/sheetstamp` (Electron 45 + React + TypeScript). Read `CLAUDE.md` and `docs/specification.md` first; the spec wins.

## Intent
Fill Word and image templates from CSV or Excel into one ZIP, offline. Phase 1 and the user-feedback rounds are done and merged. What is left is releasing v0.2.1, a few owner decisions and clean-up.

## Where it stopped
- `main` = `9b5f4a4` (PR #45, merged, CI green). Working tree clean. No open PRs. Local branches: `main` plus 14 stale `worktree-agent-*`.
- `package.json` = `0.2.0`. Tag `v0.2.0` is on `28b72b6` and the release is published with 3 installers and `SHA256SUMS.txt`. PR #45 came **after** that tag, so its changes are in no release yet.
- Open issues: #32 (epic E-4) and #33 (T-40) are done in fact but still open.
- Verified on `main`'s content before merge: `npx biome check src tests`, `npx tsc --noEmit`, `npx vitest run` (471 passed), Playwright 63 passed at 1024x768 (`npm run build:e2e`, then `env -u NODE_OPTIONS xvfb-run -a -s "-screen 0 1024x768x24" npx playwright test`).
- **Not verified:** the Ubuntu launcher icon on a real desktop (only `.deb` contents checked); glass surfaces on a real Windows/GPU display; English screenshots of the new screens; the stacked (under 576 px) Match columns layout; `sloplint` was never run (renderer needs the Electron bridge, a stub would be needed).

## Owner decisions already made (not all are in a file)
- ZIP name `Sheetstamp_<yyyy-mm-dd>_<HHmmss>.zip`. Match: Word tags by name, image fields by position, "match the remaining in column order" button.
- Word preview full width, 60vh, zoom 50 to 200%. Groups: add a group; template names unique per group (blocked).
- Image editor: no Advanced, no Preview; a box always shows its **field name**; bold/italic toggles and alignment icons.
- **Edit dialogs (Word and image) have no file name pattern field.** The stored pattern is kept; the Export step checks it. `UpdateRequest.filenamePattern` is optional.
- **Match columns** = rows "Excel column (select, first-row value) -> Template field (status)", two columns when the container is wide, progress bar.
- Font **Geist** (OFL, bundled). Apple SF cannot be bundled (licence, from memory); JetBrains Mono was offered and dropped. Hallmark restyle (tinted neutrals, three surfaces) approved; **glassmorphism was merged** (trial, easy to drop: `glass*` classes and `@utility` blocks in `src/renderer/styles.css`).
- Burger button top left closes and reopens the menu (stored in `localStorage` key `sheetstamp.menu`).
- Tag note in the new-template dialog uses a looping HTML/CSS example (dashed curves drawn with `clip-path`), not an image.
- The in-app "cancel" complaint was really "no way to start over": "Start over" button exists. Export Cancel already worked.

## Standing rules from the owner
- **Create a PR only when asked.** One branch and one PR for a batch. Merge only after CI is green and when the owner's flow says so ("tao pr > check ci > merge"). Send screenshots (light and dark) **before** opening a PR when asked.
- Poll CI every 20 s when asked. GitHub MCP tools only (no `gh`). Unauthenticated `curl https://api.github.com/repos/nhhthong/sheetstamp/commits/<sha>/check-runs` works for polling a commit (parse `check_runs[].name`, `conclusion or status`; done when `ci=success`).
- Commits end with the `Co-Authored-By` and `Claude-Session` lines from the attribution reminder. PR bodies end with the generated-with line. No model name in commits or PRs.
- `docs/agents/workflow.md` says `Mode: empowerment` but "Always pause" still holds: publishing a release, deleting data, force-push, merging outside the approved flow.
- The sandbox classifier **denies** `rm -rf` of worktrees, `git push --delete`, tag pushes and `/tmp` sweeps. Do not retry or work around; give the owner the command.

## First action on resume
`cd /home/user/sheetstamp && git fetch origin && git status && git log --oneline -3`, then tell the owner the list below in Vietnamese, short, and ask which to start with. Do not start anything that creates a PR until asked.

## What is left
Tasks for the agent, when the owner says go:
1. **Release v0.2.1:** PR bumping `package.json` and `package-lock.json` to `0.2.1` plus the site note (`scripts/site/strings.{en,vi}.json`, then `node scripts/build-site.mjs`). The owner pushes tag `v0.2.1`. No need to delete tags this time.
2. Close #32 and #33 with a comment pointing at PRs #31, #39 to #45.
3. Append the decisions above to `.work/notes.md` (format in `docs/agents/workflow.md`).
4. Optional: a small Electron-bridge stub so `sloplint --render` can run; EN screenshots of Match columns, burger and Edit dialog; the stacked Match layout.
5. Dead code left on purpose: the `checkPattern` and `sampleRow` IPC channels are no longer called by the renderer.

Needs the owner:
6. Choose how to show the demo video: button that opens the browser (recommended, `shell.openExternal` like "Check for new version"), bundle `site/assets/how.mp4` (1.7 MB, needs `media-src 'self'` in the CSP), or none. The app promises offline and no network, so no streaming from a URL.
7. Keep or drop the glass look after seeing it on a real display.

Owner-only actions:
8. Install the new `.deb` on Ubuntu and confirm the icon. Check `SHA256SUMS.txt`.
9. On the Releases page: delete the empty draft "Sheetstamp 0.2.0" (untagged) and the old draft "Sheetstamp 0.1.0" (id 427915124); replace the auto-generated v0.2.0 notes if wanted.
10. Run the clean-up commands: remove the 14 `.claude/worktrees/agent-*` worktrees (`git worktree remove --force`, then `git branch -D 'worktree-agent-*'`), delete merged remote branches (`git push origin --delete <name>`), clear Playwright temp dirs in `/tmp`.
11. Confirm rights to the Gemini-generated mp3 used in the demo video.
12. Later: code signing for the Windows installer (SignPath), Microsoft Store (needs an MSIX target), macOS is internal test only (`release.yml` job `macos-test`).

## Gotchas that cost time
- `release.yml` requires tag == `package.json` version. Creating a release in the web UI before the workflow makes a duplicate draft. `tests/e2e/smoke.spec.ts` now reads the expected version from `package.json`.
- Run e2e at **1024x768** like the Windows runner. `home-mapping.spec.ts` is serial and order-dependent: do not run a single test with `-g`. After `npm run build:e2e` before every Playwright run.
- Tailwind v4 with custom `@utility glass*`: do not combine with `bg-raised` or `border-*` on the same element; use `cn()` (twMerge) and conditional classes, otherwise class order decides.
- lightningcss merged `animation` shorthand rules and dropped them: gate the animations in `@media (prefers-reduced-motion: no-preference)`. SVG `mask` with animated children did not work in Chromium here; `clip-path: inset()` did.
- `autoFocus` scrolled the page on a short window and broke an image-editor drag test: focus with `focus({ preventScroll: true })`.
- A monitor script with nested quotes in a Python one-liner failed silently (empty output, never emitted). Test a polling script once on a known sha before trusting it.
- `mcp__github__list_pull_requests` can return 60k characters: it is saved to a file, parse with Python.
- Closing keywords: "Closes #20, #21" closes only the first issue.
- Worktrees from sub-agents have untracked `node_modules`, so a plain `git worktree remove` fails.

## Suggested skills
- `dev:implement-ticket` (one ticket end to end), `dev:plan-tickets`, `dev:review-pr` (PR body), `dev:session-progress`.
- `hallmark` (the owner types `/hallmark` for any UI restyle; app scope, keep layout).
- `/dev:clarify-grill` (the owner types it to be questioned before a plan).

## Where things are (do not duplicate)
Spec `docs/specification.md`; workflow and tracker rules `docs/agents/`; earlier handoff `.work/handoff/handoff-sheetstamp-field-matching.md`; Hallmark audit `.work/research/hallmark-audit.md`; tickets `.work/tickets/tracked/`; PRs #28 to #45, issues #32 to #38; release https://github.com/nhhthong/sheetstamp/releases/tag/v0.2.0.
