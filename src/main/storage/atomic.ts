import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import path from "node:path";

export type RenameFn = (from: string, to: string) => Promise<void>;

/**
 * Writes `bytes` to `target` so a crash leaves either the old or the new file, never a torn one:
 * temp file in the same folder, flushed to disk, then renamed over the target. A failed write removes
 * its temp file; after a hard crash the leftover `*.tmp` is ignored by readers and swept on open.
 */
export async function writeFileAtomic(
  target: string,
  bytes: string | Uint8Array,
  rename: RenameFn = fsp.rename,
): Promise<void> {
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    const handle = await fsp.open(tmp, "w");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, target);
  } catch (error) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  await syncFolder(path.dirname(target));
}

/** Best effort: Windows cannot open folders for sync. */
async function syncFolder(folder: string): Promise<void> {
  try {
    const handle = await fsp.open(folder, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // ignored on purpose
  }
}

/** Removes temp files left by an interrupted write. */
export async function sweepTempFiles(folder: string): Promise<void> {
  for (const entry of await fsp.readdir(folder).catch(() => [] as string[])) {
    if (entry.endsWith(".tmp")) await fsp.rm(path.join(folder, entry), { force: true });
  }
}

/** First free `<file>.bak`, `<file>.bak.1`, `<file>.bak.2`, ... so an older backup is never overwritten. */
export async function freeBackupName(folder: string, file: string): Promise<string> {
  for (let n = 0; ; n++) {
    const name = n === 0 ? `${file}.bak` : `${file}.bak.${n}`;
    try {
      await fsp.access(path.join(folder, name));
    } catch {
      return name;
    }
  }
}
