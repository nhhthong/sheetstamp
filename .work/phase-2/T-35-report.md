# T-35 report
- Open command: `app:open-download-page` takes no argument (`nothing` parser refuses any value); main calls `shell.openExternal(DOWNLOAD_PAGE_URL)` looked up at call time. e2e replaces `shell.openExternal` from the test (app.evaluate) and records calls; no e2e-only code in the app.
- Electron dates: `src/shared/electron-support.ts` (45 -> 2027-04-27, same as site/index.html and spec line 43); unit test fails when the package.json major or the installed major has no entry.
- Texts: LICENSE and THIRD-PARTY-NOTICES.md read in main from `process.resourcesPath` (packaged, via extraResources) or `app.getAppPath()` (unpackaged).
- Not done: "a test blocks the network and the app starts" criterion; the app adds no network call, but no test was written for it. The packaged-app presence of the notices was not verified (no electron-builder run).
- The download page is shown as plain text (an anchor would navigate and be blocked).
