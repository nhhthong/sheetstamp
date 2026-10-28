# T-11: Release pipeline

**Type:** task
**Parent:** E-0
**Requirements:** R0.9, R0.10, R0.11, R13.1, R13.5, R13.8, R13.9
**Blocked by:** T-2, T-9
**Status:** ready
**New infrastructure:** electron-builder targets: NSIS, deb, AppImage, mac dir (ad hoc)
**Files:** .github/workflows/release.yml, electron-builder config, scripts/release
**Proof:** A tagged draft release holds `Sheetstamp-Setup-x64.exe`, the `.deb`, the AppImage and `SHA256SUMS.txt`; it is then published and `releases/latest/download/<fixed-filename>` downloads each file.
**Step:**
**Base:**
**Baseline:**

**What to build:** CI builds installers on Windows and Ubuntu and a macOS ad hoc build kept only as a one-day workflow artifact (decision of T-9). Release assets have fixed names. A release is created as a draft, assets are uploaded, then it is published in one step. Version `0.x` is not marked pre-release. The Windows per-user NSIS installer carries publisher and version info, no UPX, and is scanned with VirusTotal. Manual checks: install on clean Windows and Ubuntu 22.04/24.04 (`.deb` and AppImage) and record the macOS warning.

- [ ] Draft release contains all assets with fixed names and `SHA256SUMS.txt`.
- [ ] `releases/latest/download/<fixed-filename>` works after publishing.
- [ ] Clean-machine installs succeed on Windows (per-user, no admin) and Ubuntu (`.deb` and AppImage); results are recorded.
- [ ] VirusTotal scan result and any Defender warning are recorded.
- [ ] The macOS artifact expires after one day and is not attached to the public release; the warning text is recorded.

## Test plan (added by /dev:implement-ticket)

## Result
