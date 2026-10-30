# T-45: Hallmark restyle: audit and proposal

**Type:** spike
**Parent:** E-4 (#32)
**Requirements:** none
**Blocked by:** T-44 (#37)
**Status:** in-review
**Tracker:** #38
**New infrastructure:** none
**Files:** .work/research/hallmark-audit.md
**Proof:** the audit file; the owner approves or edits it.
**Step:** close
**Base:** 4fdf665

**What to build:** An audit of the current UI and a restyle proposal that keeps the layout. No app code.

- [x] Audit and proposal written
- [ ] Owner approves (blocks the build ticket)

## Result
Goal: give the owner something to approve before any restyle.

Written: `.work/research/hallmark-audit.md`. The linter was not run (the renderer needs the Electron bridge); findings are from 17 screenshots and the tokens, stated in the file.
ASK: which depth? -> restyle (owner Q9 option 1). ASK: audit only now? -> yes, build after approval.
Applied: hallmark (redesign.md, audit part); skip: sloplint --render (needs the bridge).
