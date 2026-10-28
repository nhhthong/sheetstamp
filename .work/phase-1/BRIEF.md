# Brief for implementer sub-agents (Phase 1)

You implement ONE ticket of Phase 1 of Sheetstamp in your own git worktree. Read these first, in order:
`CLAUDE.md`, `GLOSSARY.md`, `docs/agents/workflow.md`, your ticket file under `.work/tickets/phase-1/`,
`.work/spec-index.md` (requirement codes of your ticket), `docs/specification.md` sections 5 and 5.1 for the screens
you build, `.work/phase-0-report.md` and `.work/phase-1-report.md` (decisions already made), `docs/adr/0001-json-storage.md`.
Then follow `.claude/skills/implement-ticket/SKILL.md` from orient to build as far as it fits (write the `Step:` lines,
`Base:` commit, a short `## Test plan`, and `## Result` into YOUR ticket file only).

## Rules of the house

- English for code, identifiers, comments, commits. Vietnamese only in user-visible strings.
- Every user-visible string goes into a strings file of your own, `src/renderer/strings/<feature>.ts` (export a const
  object like `vi.ts` does). Do NOT edit `src/renderer/strings/vi.ts` (shared); import from it if you need.
- TypeScript strict, Biome (`npx biome check --write .`), tests next to code (`*.test.ts`), fixtures in `tests/fixtures/`.
  Surgical changes: touch only the files your ticket owns (below). If you need a change outside them, make the smallest
  possible edit and say so in your report.
- Dependencies are already installed in the main checkout: `ln -s /home/user/sheetstamp/node_modules node_modules` in
  your worktree. Do not run `npm install` and do not edit `package.json` or `package-lock.json`. If you truly need a new
  dependency, stop and report it as BLOCKED with the reason.
- IPC: channels live in `src/shared/ipc/<feature>.ts` (declare with `channel()` and a validating `parse`), handlers in
  `src/main/ipc/<feature>.ts` (use `handle()`), the renderer calls with `call()` from `src/renderer/lib/ipc.ts`. Each
  feature module already exists as an empty stub for you to fill. Never add a channel to `registry.ts` (it lists modules,
  not channels). Validate every argument; never trust the renderer.
- UI: Tailwind tokens and components in `src/renderer/components/ui/*` (Button, Input, Select, Field, Dialog, Toast,
  Status). Spec section 5.1 is the design spec: sentence case Vietnamese, one primary button bottom-left, status never by
  colour alone, visible focus, keyboard reachable, inline confirmation for destructive actions.
- Imported CSV or Excel data is never written to disk. Uses existing Phase 0 modules: `src/main/data/*`,
  `src/main/template-engine/*`, `src/main/export/*`, `src/worker/*`.
- No test data to find on the web: generate it with scripts or helpers (see `src/main/selftest/make-docx.ts`,
  `tests/fixtures/data/make-data.ts`). Ambiguities: research first (spec, code, library docs), choose, and record the
  question, the options, your choice and why. When two options are plausible and a run can tell, run a throwaway
  prototype (under `prototypes/phase1/`) and keep the evidence.

## How to check your work (run all before reporting)

`npx biome check .`, `npm run typecheck`, `npx vitest run` (whole suite), and if your ticket has UI or app behaviour:
`npm run build` then `env -u NODE_OPTIONS xvfb-run -a npx playwright test <your spec file>` (the container sets
`NODE_OPTIONS=--use-openssl-ca`, which Electron rejects; always unset it for Electron). Look at screenshots of any UI
you build (Read the PNG) in light and dark. Do not run GitHub Actions or touch workflows.

## Git

Commit in your worktree branch when your proof is green: message `feat: <what> (T-xx)`, then a blank line, then
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
`Claude-Session: https://claude.ai/code/session_019Cd4QJApFvAJck8ijqSqUp`. Do not push, do not merge, do not open a PR.
Write a report file `.work/phase-1/<ID>-report.md` (new file, in your worktree, committed) with: ambiguities met, the
options, what you chose and why, evidence, and open items. Update only your own ticket file (`Status:`, `Result`).

## Final message (exactly this block, nothing else important elsewhere)

```
<ID>: PASS | ISSUES | BLOCKED
Head: <worktree path> <git rev-parse HEAD>, <n> uncommitted files
Proof: <command> -> <the output lines that decide it>
Files: <changed files>
Issues: <each problem you can prove, or "none">
Ambiguities: <one line each: question -> choice -> why>
```
