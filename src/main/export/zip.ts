import { createWriteStream } from "node:fs";
import { link, mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Writable } from "node:stream";
import { ZipArchive } from "archiver";
import { errorReportCsv, type RowError, type RowErrorCode } from "./report";

export type ZipEntry = { name: string; data: Uint8Array };

export type Progress = { done: number; total: number; failed: number };

export type ExportRequest = {
  folder: string;
  /** File name of the ZIP including `.zip`. A number is added if it already exists. */
  zipName: string;
  total: number;
  /** Build the file for row `index` (0-based). A thrown error fails that row only. */
  produce: (index: number) => Promise<ZipEntry>;
  /** How many rows may be in production at once (default 1). Files are still written in row order. */
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  /** Where the ZIP bytes go while it is built. Default: a file stream. Tests pass a failing stream. */
  createOutput?: (path: string) => Writable;
};

export type ExportResult = {
  zipPath: string;
  written: number;
  failed: RowError[];
  /** Present only when at least one row failed. */
  reportPath?: string;
  /** True when rows failed but the report file could not be written. The ZIP is still the result. */
  reportFailed?: boolean;
};

export class ExportCancelledError extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportCancelledError";
  }
}

/** Error with a `code` is reported under that code; anything else is `render-failed`. */
export class RowFailure extends Error {
  constructor(readonly code: RowErrorCode) {
    super(code);
    this.name = "RowFailure";
  }
}

/** Names are compared the way file systems may: after NFC and without case. */
const key = (name: string) => name.normalize("NFC").toLowerCase();

const errorCode = (error: unknown) => (error as { code?: unknown } | null)?.code;

/**
 * Put the finished temporary file under a free name without ever replacing a file. Candidates are compared with
 * `key()` against every name in the folder (case-insensitive and normalization-insensitive file systems), and the
 * last step is exclusive: `link` fails with EEXIST when the name was taken meanwhile, then the next number is tried.
 * Only where hard links are unsupported (some network and FAT-like file systems) does it fall back to `rename`,
 * which is not exclusive; the name check above is the only protection there.
 */
async function publish(folder: string, tempPath: string, name: string): Promise<string> {
  const ext = extname(name);
  const stem = basename(name, ext);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
    const taken = new Set((await readdir(folder)).map(key));
    if (taken.has(key(candidate))) continue;
    const target = join(folder, candidate);
    try {
      await link(tempPath, target);
    } catch (error) {
      const code = errorCode(error);
      if (code === "EEXIST") continue;
      if (code === "EPERM" || code === "ENOTSUP" || code === "EOPNOTSUPP" || code === "ENOSYS") {
        await rename(tempPath, target);
        return target;
      }
      throw error;
    }
    await unlink(tempPath);
    return target;
  }
}

/** Write the report under a free name; `wx` makes the creation exclusive. A half-written report is removed. */
async function writeReport(folder: string, zipName: string, text: string): Promise<string> {
  const ext = ".csv";
  const stem = `${basename(zipName, ".zip")}-errors`;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${stem}${ext}` : `${stem} (${n})${ext}`;
    const taken = new Set((await readdir(folder)).map(key));
    if (taken.has(key(candidate))) continue;
    const target = join(folder, candidate);
    try {
      await writeFile(target, text, { encoding: "utf8", flag: "wx" });
      return target;
    } catch (error) {
      if (errorCode(error) === "EEXIST") continue;
      await unlink(target).catch(() => undefined);
      throw error;
    }
  }
}

const TEMP_NAME = /^\.sheetstamp-\d+-\d+\.tmp$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Delete `.sheetstamp-*.tmp` files older than a day (left by a killed process). Never touches other files. */
export async function sweepStaleTemps(folder: string, now: number = Date.now()): Promise<void> {
  const names = await readdir(folder).catch(() => [] as string[]);
  for (const name of names) {
    if (!TEMP_NAME.test(name)) continue;
    const path = join(folder, name);
    const info = await stat(path).catch(() => undefined);
    if (info?.isFile() && now - info.mtimeMs > DAY_MS) await unlink(path).catch(() => undefined);
  }
}

/**
 * Stream the ZIP to a temporary file in the destination folder and rename it when complete.
 * Cancel and failure remove the temporary file, so nothing partial is left behind.
 */
export async function exportZip(request: ExportRequest): Promise<ExportResult> {
  const { folder, total, produce, signal, onProgress } = request;
  const concurrency = Math.max(1, request.concurrency ?? 1);
  type Settled = { entry: ZipEntry } | { error: unknown };
  const started = new Map<number, Promise<Settled>>();
  const start = (index: number) => {
    if (index < total && !started.has(index)) {
      started.set(
        index,
        produce(index).then(
          (entry): Settled => ({ entry }),
          (error: unknown): Settled => ({ error }),
        ),
      );
    }
  };
  await mkdir(folder, { recursive: true });
  const tempPath = join(folder, `.sheetstamp-${process.pid}-${Date.now()}.tmp`);
  const output = request.createOutput
    ? request.createOutput(tempPath)
    : createWriteStream(tempPath, { flags: "wx" });
  const archive = new ZipArchive({ zlib: { level: 6 } });
  let writeError: unknown;
  const finished = new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => {
      writeError ??= error;
      reject(error);
    };
    output.on("close", resolve);
    output.on("error", fail);
    archive.on("error", fail);
  });
  finished.catch(() => undefined); // observed through `race` below; avoids an unhandled rejection meanwhile
  archive.pipe(output);

  const failed: RowError[] = [];
  let written = 0;
  let zipPath: string;
  try {
    for (let index = 0; index < total; index++) {
      if (writeError) throw writeError;
      if (signal?.aborted) throw new ExportCancelledError();
      for (let ahead = index; ahead < index + concurrency; ahead++) start(ahead);
      const settled = await started.get(index);
      started.delete(index);
      if (settled && "entry" in settled) {
        const added = new Promise<void>((resolve) => archive.once("entry", () => resolve()));
        archive.append(Buffer.from(settled.entry.data), { name: settled.entry.name });
        // After a write error the "entry" event never comes; `finished` rejects then.
        await Promise.race([added, finished]);
        if (writeError) throw writeError;
        written++;
      } else {
        const error = settled?.error;
        if (error instanceof ExportCancelledError) throw error;
        failed.push({
          row: index + 1,
          code: error instanceof RowFailure ? error.code : "render-failed",
        });
      }
      onProgress?.({ done: index + 1, total, failed: failed.length });
    }
    if (signal?.aborted) throw new ExportCancelledError();
    await Promise.race([archive.finalize(), finished]);
    await finished;
    zipPath = await publish(folder, tempPath, request.zipName);
  } catch (error) {
    archive.abort();
    output.destroy();
    // Bounded: a stream that never closes must not hold the export (and the window) forever.
    await Promise.race([finished.catch(() => undefined), new Promise((r) => setTimeout(r, 5000))]);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  let reportPath: string | undefined;
  let reportFailed: boolean | undefined;
  if (failed.length > 0) {
    try {
      reportPath = await writeReport(folder, basename(zipPath), errorReportCsv(failed));
    } catch {
      reportFailed = true; // the ZIP is finished; a missing report must not turn it into a failure
    }
  }
  return { zipPath, written, failed, reportPath, reportFailed };
}
