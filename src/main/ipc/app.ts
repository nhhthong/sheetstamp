import { app } from "electron";
import { appInfo } from "../../shared/ipc/app";
import { handle } from "./define";

export function register(): void {
  handle(appInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
}
