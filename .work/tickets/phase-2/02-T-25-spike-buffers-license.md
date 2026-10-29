# T-25: Spike: license of buffers

**Type:** spike
**Parent:** E-2
**Requirements:** R11.4, R13.10, R14.5
**Blocked by:** None (can start immediately)
**Status:** in-review
**New infrastructure:** none
**Files:** .work/notes.md, docs/specification.md
**Proof:** A decision note (confirmed license with a source, or the replacement plan) is in `.work/notes.md` and O-14 is closed in the spec index.
**Step:**
**Base:**
**Baseline:**

**What to build:** Question (O-14): the transitive dependency `buffers@0.1.1` (via exceljs) declares no license, and only OSI-approved licenses may ship. npm shows only the repository `substack/node-buffers`; raw GitHub content could not be read from the planning environment, so the license is unconfirmed. Find the license in the upstream repository, the tarball or the maintainer's statement and record the source. If it cannot be confirmed, decide between asking the maintainer, vendoring a licensed replacement, or replacing the xlsx reader behind its interface, and cut a ticket for the chosen route with `plan-ticket-change`. Close through `explore-decide`.

- [ ] The license is confirmed with a link to the evidence, or a replacement route is decided and ticketed.
- [ ] `THIRD-PARTY-NOTICES.md` no longer lists `buffers` as UNDECLARED when the license is confirmed.
- [ ] O-14 is marked resolved in the spec index with the evidence.

## Test plan (added by /dev:implement-ticket)

## Result
