# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md). The product spec is `docs/specification.md`; where it states a decision, it wins.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Research before asking.** When a problem is ambiguous, research first (the spec, the code, library docs and source, the web) and come back with at least one concrete suggestion, not a bare question.
- Name the ambiguity, then give the recommended option with its reason and the evidence behind it. Add the alternatives only when they genuinely differ.
- Cite sources. Keep what you verified apart from what you inferred. If research finds nothing, say so; never invent facts or sources.
- Check items the spec lists as "not yet verified" before relying on them.
- Ask the user only for what research cannot settle: a product decision, a preference, missing context.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Conventions

- Layout (electron-vite): `src/main`, `src/preload`, `src/renderer`, `src/shared` (types, IPC contracts), `src/worker` (heavy work). Tests beside code (`*.test.ts`); golden fixtures in `tests/fixtures`.
- TypeScript `strict`, Biome defaults, npm. Code, identifiers, commits and docs in English; only the UI is Vietnamese.
- Terms follow `GLOSSARY.md`; decisions in `docs/adr/` and `docs/specification.md`.

## Agent skills

### Issue tracker

GitHub Issues (`nhhthong/sheetstamp`). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.

### Workflow

Delivery: one branch and pull request per ticket; notes in-repo. See `docs/agents/workflow.md`.
