import { app, shell } from "electron";
import { endOfSupportOf } from "../../shared/electron-support";
import { about, appInfo, DOWNLOAD_PAGE_URL, openDownloadPage } from "../../shared/ipc/app";
import { handle } from "./define";

export function register(): void {
  handle(appInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
  handle(about, () => ({
    version: app.getVersion(),
    electronEndOfSupport: endOfSupportOf(process.versions.electron),
  }));
  // Looked up on `shell` at call time so the e2e test can replace it.
  handle(openDownloadPage, async () => {
    await shell.openExternal(DOWNLOAD_PAGE_URL);
    return undefined;
  });
}
