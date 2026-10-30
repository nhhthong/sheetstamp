# T-42: App icon shows on Ubuntu (default icon today)

**Type:** bug
**Parent:** E-4 (#32)
**Requirements:** none
**Blocked by:** None (can start immediately)
**Status:** in-review
**Tracker:** #35
**New infrastructure:** none
**Files:** electron-builder.yml, package.json, build/icons
**Proof:** `dpkg -c` of a freshly built `.deb` lists hicolor icons from 16 to 512 px; the desktop entry's `StartupWMClass` equals `desktopName`.
**Step:** close
**Base:** 4fdf665

**What to build:** The Ubuntu launcher, dock and window show the Sheetstamp logo.

- [x] `.deb` has icons at standard sizes and a matching desktop entry
- [x] Root cause stated with evidence

## Result
Goal: show the logo on Ubuntu.

Cause (verified on the v0.1.0 `.deb`): it shipped one icon, `hicolor/1024x1024/apps/sheetstamp.png`, and the hicolor `index.theme` has no 1024x1024 directory (512x512 is the largest), so the icon lookup finds nothing and the default shows. Second, unverified on a real desktop: `desktopName` was unset, so the window's WM_CLASS could not be linked to the `.desktop` entry (electron-builder warns about this).

Changed: `build/icons/{16,24,32,48,64,128,256,512}.png` (resized from `build/icon.png`), `linux.icon: build/icons`, `desktopName: sheetstamp.desktop` in `package.json`, `linux.syncDesktopName: true`.

Proof: `electron-builder --linux deb` built; `dpkg -c` shows 8 hicolor sizes; the desktop entry has `Icon=sheetstamp` and `StartupWMClass=sheetstamp`. Verdict: VERIFIED for packaging. NOT checked on a real Ubuntu desktop (no GUI here); the owner should install the new `.deb` and confirm.
Applied: test-plan (check tier, inline); skip: review: diff is config and images.
