import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
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
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
};

export type ExportResult = {
  zipPath: string;
  written: number;
  failed: RowError[];
  /** Present only when at least one row failed. */
  reportPath?: string;
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

const exists = async (folder: string, name: string) => (await readdir(folder)).includes(name);

async function freeName(folder: string, name: string): Promise<string> {
  const ext = extname(name);
  const stem = basename(name, ext);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
    if (!(await exists(folder, candidate))) return candidate;
  }
}

/**
 * Stream the ZIP to a temporary file in the destination folder and rename it when complete.
 * Cancel and failure remove the temporary file, so nothing partial is left behind.
 */
export async function exportZip(request: ExportRequest): Promise<ExportResult> {
  const { folder, total, produce, signal, onProgress } = request;
  await mkdir(folder, { recursive: true });
  const tempPath = join(folder, `.sheetstamp-${process.pid}-${Date.now()}.tmp`);
  const output = createWriteStream(tempPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const finished = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
  });
  finished.catch(() => undefined); // handled below; avoids an unhandled rejection while rows are produced
  archive.pipe(output);

  const failed: RowError[] = [];
  let written = 0;
  try {
    for (let index = 0; index < total; index++) {
      if (signal?.aborted) throw new ExportCancelledError();
      try {
        const entry = await produce(index);
        const added = new Promise<void>((resolve) => archive.once("entry", () => resolve()));
        archive.append(Buffer.from(entry.data), { name: entry.name });
        await added;
        written++;
      } catch (error) {
        if (error instanceof ExportCancelledError) throw error;
        failed.push({
          row: index + 1,
          code: error instanceof RowFailure ? error.code : "render-failed",
        });
      }
      onProgress?.({ done: index + 1, total, failed: failed.length });
    }
    if (signal?.aborted) throw new ExportCancelledError();
    await archive.finalize();
    await finished;
  } catch (error) {
    archive.abort();
    output.destroy();
    await finished.catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  const zipName = await freeName(folder, request.zipName);
  const zipPath = join(folder, zipName);
  await rename(tempPath, zipPath);

  let reportPath: string | undefined;
  if (failed.length > 0) {
    const reportName = await freeName(folder, `${basename(zipName, ".zip")}-errors.csv`);
    reportPath = join(folder, reportName);
    await writeFile(reportPath, errorReportCsv(failed), "utf8");
  }
  return { zipPath, written, failed, reportPath };
}
