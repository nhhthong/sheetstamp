import { app } from "electron";
import { appInfo, ping } from "../../shared/ipc/app";
import { handle } from "./define";

export function register(): void {
  handle(ping, ({ message }) => ({ message, version: app.getVersion() }));
  handle(appInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
}
