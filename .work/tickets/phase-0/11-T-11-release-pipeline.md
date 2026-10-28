# T-11: Release pipeline

**Type:** task
**Parent:** E-0
**Requirements:** R0.9, R0.10, R0.11, R13.1, R13.5, R13.8, R13.9
**Blocked by:** T-2, T-9
**Status:** in-review
**New infrastructure:** electron-builder targets: NSIS, deb, AppImage, mac dir (ad hoc)
**Files:** .github/workflows/release.yml, electron-builder config, scripts/release
**Proof:** A tagged draft release holds `Sheetstamp-Setup-x64.exe`, the `.deb`, the AppImage and `SHA256SUMS.txt`; it is then published and `releases/latest/download/<fixed-filename>` downloads each file.
**Step:** close
**Base:**
**Baseline:**

**What to build:** CI builds installers on Windows and Ubuntu and a macOS ad hoc build kept only as a one-day workflow artifact (decision of T-9). Release assets have fixed names. A release is created as a draft, assets are uploaded, then it is published in one step. Version `0.x` is not marked pre-release. The Windows per-user NSIS installer carries publisher and version info, no UPX, and is scanned with VirusTotal. Manual checks: install on clean Windows and Ubuntu 22.04/24.04 (`.deb` and AppImage) and record the macOS warning.

- [ ] Draft release contains all assets with fixed names and `SHA256SUMS.txt`. (open: needs a tag push or a person)
- [ ] `releases/latest/download/<fixed-filename>` works after publishing. (open: needs a tag push or a person)
- [ ] Clean-machine installs succeed on Windows (per-user, no admin) and Ubuntu (`.deb` and AppImage); results are recorded. (open: needs a tag push or a person)
- [ ] VirusTotal scan result and any Defender warning are recorded. (open: needs a tag push or a person)
- [x] The macOS artifact expires after one day and is not attached to the public release.
- [ ] The macOS warning text is recorded (open: needs a Mac).

## Test plan (added by /dev:implement-ticket)

## Result

Goal: a release pipeline that builds installers on all three OSes with fixed names and publishes through draft, upload, publish.
Proof: manual run of `Release` on main (run 40721739906): build and packaged self-test succeeded on windows-latest, ubuntu-latest and macos-latest; installers uploaded with `if-no-files-found: error`; the publish job was skipped as designed (no tag).
Verdict: INCONCLUSIVE for the publish path (draft, upload, publish, latest/download links), the clean-machine installs, VirusTotal and the macOS warning: they need a tag push and human checks. VERIFIED for the build and self-test part.
To finish: `git tag v0.1.0 && git push origin v0.1.0` (publishes a release), then the manual checks in the ticket.
Decisions: see `.work/phase-0-report.md` (T-11).
Applied: skip: review: typed.
