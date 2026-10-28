# T-12: Repo and pages

**Type:** task
**Parent:** E-0
**Requirements:** R0.1, R13.7, R13.10
**Blocked by:** None (can start immediately)
**Status:** in-review
**New infrastructure:** none
**Files:** LICENSE, README.md, THIRD-PARTY-NOTICES.md, docs/index.html, .github/workflows/pages.yml
**Proof:** `https://nhhthong.github.io/sheetstamp` serves the download page, and the repository shows an MIT license.
**Step:** close
**Base:**
**Baseline:**

**What to build:** The public face of the project: `LICENSE` (MIT), a feature-focused `README`, a Vietnamese download page on GitHub Pages with buttons pointing at `releases/latest/download/<fixed-filename>`, installation instructions, a "Code signing policy" section, a third-party notices file, and the macOS "Coming soon" note.

- [x] `LICENSE` is MIT and GitHub detects it.
- [ ] The Pages site is live with Windows and Ubuntu buttons, instructions in Vietnamese and the signing policy section (owner: enable Pages).
- [x] `THIRD-PARTY-NOTICES.md` lists runtime dependencies with their licenses.
- [ ] Two-factor authentication is on for the account (owner confirms).

## Test plan (added by /dev:implement-ticket)

## Result

Goal: LICENSE, README, third-party notices, a Vietnamese download page and its Pages workflow.
Proof: `node scripts/third-party-notices.mjs --check` exits 0; `site/index.html` is well-formed; workflows parse. Verdict: INCONCLUSIVE for "the Pages site is live": needs the owner to set Pages source to GitHub Actions and enable 2FA (see report T-12).
Decisions: see `.work/phase-0-report.md` (T-12).
Applied: skip: review: typed.
