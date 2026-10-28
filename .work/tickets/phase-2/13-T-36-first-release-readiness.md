# T-36: First release readiness

**Type:** task
**Parent:** E-2
**Requirements:** R13.7, R13.10, R11.4, R6.6, R0.10, R0.11
**Blocked by:** T-25, T-27, T-31, T-33, T-35
**Status:** ready
**New infrastructure:** none
**Files:** THIRD-PARTY-NOTICES.md, README.md, site/index.html, docs/specification.md, .work/phase-2-report.md
**Proof:** A dry run of the `Release` workflow is green, `SHA256SUMS.txt` lists the three installers, the owner's checklist in `.work/phase-2-report.md` is complete, and the owner pushes the tag `v0.1.0` (publishing is the owner's action).
**Step:**
**Base:**
**Baseline:**

**What to build:** Close what stands between the green build and a public first release: regenerate the notices with the final dependency set, finish the download page (Vietnamese install steps; screenshots taken from the packaged app on Windows and Ubuntu), settle O-10 by checking the UTF-8 flag display of ZIP names on Windows 10/11, Ubuntu and, if reachable, macOS (including an NFD name), and write the clean-machine checklist (Windows per-user install, Ubuntu `.deb` and AppImage, VirusTotal scan, Defender warning noted). Claude does not publish: the report lists what the owner must do (enable Pages, 2FA, tag the release, apply to SignPath afterwards).

- [ ] The notices cover every shipped dependency and list no UNDECLARED license.
- [ ] The download page shows the three buttons with the fixed names, the checksum link, the install steps with screenshots, and the "Coming soon" note for macOS.
- [ ] O-10 is resolved in the spec index with the observed display on each operating system, or the gap is recorded as a known issue on the page.
- [ ] A report states the result of each clean-machine check, or that it is still owed by the owner and why.
- [ ] The release workflow's dry run passes and the publish step is untouched until the owner tags.
- [ ] No release is published, signed or submitted by Claude.

## Test plan (added by /dev:implement-ticket)

## Result
