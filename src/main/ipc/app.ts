import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, shell } from "electron";
import { endOfSupportOf } from "../../shared/electron-support";
import { about, appInfo, DOWNLOAD_PAGE_URL, openDownloadPage } from "../../shared/ipc/app";
import { handle } from "./define";

/** LICENSE and THIRD-PARTY-NOTICES.md: in resources/ of a packaged app (extraResources), else the repository root. */
const textFile = (name: string) =>
  readFile(join(app.isPackaged ? process.resourcesPath : app.getAppPath(), name), "utf8");

export function register(): void {
  handle(appInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
  handle(about, async () => ({
    version: app.getVersion(),
    electronEndOfSupport: endOfSupportOf(process.versions.electron),
    licence: await textFile("LICENSE"),
    notices: await textFile("THIRD-PARTY-NOTICES.md"),
  }));
  // Looked up on `shell` at call time so the e2e test can replace it.
  handle(openDownloadPage, async () => {
    await shell.openExternal(DOWNLOAD_PAGE_URL);
    return undefined;
  });
}
