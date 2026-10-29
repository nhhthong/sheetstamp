// The app-wide storage singleton. Other features import `getStorage()` instead of opening the folder again.

import { join } from "node:path";
import { app } from "electron";
import { t } from "../../shared/i18n";
import type { StorageStatus } from "../../shared/ipc/storage";
import { openStorage, type Storage, StorageError } from "../storage";

/** Data folder: `SHEETSTAMP_DATA_DIR` (used by tests) or `<userData>/data`. */
export function dataDir(): string {
  return process.env.SHEETSTAMP_DATA_DIR || join(app.getPath("userData"), "data");
}

let opened: Promise<Storage> | undefined;

/** What opening the data folder found, for the banner in the UI. Never throws and never changes any file. */
export async function storageStatus(): Promise<StorageStatus> {
  try {
    const storage = await getStorage();
    return {
      warnings: storage.warnings.map(({ file, message }) => ({ file, message })),
      error: null,
    };
  } catch (error) {
    if (error instanceof StorageError && (error.code === "newer-schema" || error.code === "io")) {
      return { warnings: [], error: { code: error.code, message: error.message } };
    }
    return {
      warnings: [],
      error: {
        code: "io",
        message: t(
          "Không mở được thư mục dữ liệu của ứng dụng.",
          "Could not open the app's data folder.",
        ),
      },
    };
  }
}

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
