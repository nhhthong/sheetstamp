// The app-wide storage singleton. Other features import `getStorage()` instead of opening the folder again.
import { join } from "node:path";
import { app } from "electron";
import { openStorage, type Storage } from "../storage";

/** Data folder: `SHEETSTAMP_DATA_DIR` (used by tests) or `<userData>/data`. */
export function dataDir(): string {
  return process.env.SHEETSTAMP_DATA_DIR || join(app.getPath("userData"), "data");
}

let opened: Promise<Storage> | undefined;

/** Opens the storage on first use and returns the same instance afterwards. `storage.warnings` keeps what was found. */
export function getStorage(): Promise<Storage> {
  if (!opened) {
    const attempt = openStorage(dataDir());
    attempt.catch(() => {
      opened = undefined; // let a later call retry
    });
    opened = attempt;
  }
  return opened;
}
