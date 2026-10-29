# T-27 report: packaging, icon, release dry run

## Done
- `build/icon.svg` (original mark: document with a stamped check), `scripts/make-icons.mjs` renders it with @napi-rs/canvas (already pinned) to `build/icon.png` (1024) and `build/icon.ico` (16..256, PNG entries, hand-written ICO container, no new dependency). Output is deterministic.
- `electron-builder.yml`: explicit `win.icon`, `linux.icon`, `nsis.uninstallDisplayName`. electron-builder already writes ProductName, LegalCopyright, FileVersion, ProductVersion into the exe from `productName`, `copyright` and `package.json` (read in `app-builder-lib/out/winPackager.js` signAndEditResources); nothing else was needed in `win`.
- `scripts/check-package-metadata.mjs` (+ test): reads the exe's version resource (pe-library + resedit, work on any OS) and the .deb control (`dpkg-deb -f`), compares with package.json (name, version) and `productName` in electron-builder.yml. Exe: ProductName, FileVersion, ProductVersion (0.1.0 == 0.1.0.0), LegalCopyright non-empty. Deb: Package, Version.
- `release.yml`: two steps, Windows exe check and .deb check. Draft-then-publish untouched.
- `package.json`: `homepage` (fpm refuses to build a .deb without it when git has no remote), `pe-library` 0.4.1 and `resedit` 1.7.2 as exact devDependencies (both were already in the lockfile transitively via electron-builder; lockfile root entry edited by hand to add just those two lines, because `npm --package-lock-only` also added unrelated optional entries).
- `vitest.config.ts`: include `scripts/**/*.test.ts`.

## Verified locally
- Linux deb built from a clean `npm ci` copy (scratchpad/pk, fake origin remote): exit 0, `dpkg-deb -f`: Package sheetstamp, Version 0.1.0, Homepage set; deb holds `usr/share/applications/sheetstamp.desktop` (Icon=sheetstamp) and `usr/share/icons/hicolor/1024x1024/apps/sheetstamp.png`.
- Packaged self-test on linux-unpacked: `self-test OK` (word 12, image 12).
- check-package-metadata on that deb: `metadata OK`.
- Exe checker tested against a synthetic exe (version resource stamped into a copy of electron-winstaller's StubExecutable.exe): matching metadata passes, "Electron"/45.1.0 reports two problems.

## Not verified (cannot run here)
- Windows and macOS packaging, the real Sheetstamp.exe version resource (the synthetic PE only proves the reader), the NSIS installer's own metadata/uninstall entry, the icon inside the exe, and the GitHub dry run itself (not triggered, as instructed).

## Traps found
- In the worktree (node_modules symlinked to the main checkout) electron-builder mis-collects dependencies ("cannot find path for dependency ... undefined") and the packaged app fails with `Cannot find module 'process/'`. A real `npm ci` fixes it. Do not package from a symlinked worktree.
- Without a git remote `electron-builder` fails after writing the deb ("Cannot read properties of null (reading 'channel')"); CI has a remote. Not caused by this ticket.
- electron-builder hints to set `desktopName` and `linux.syncDesktopName` so the running window links to the menu entry. Not done (not asked); candidate follow-up.
