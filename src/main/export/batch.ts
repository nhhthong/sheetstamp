import { availableParallelism } from "node:os";
import { basename, join } from "node:path";
import { type GenerateInit, type GenerateJob } from "../../worker/generate-job";
import { JobError, WorkerPool } from "../../worker/pool";
import { maxNameLength, planFileNames } from "./filename";
import type { RowErrorCode } from "./report";
import { type ExportResult, exportZip, type Progress, RowFailure } from "./zip";

export type BatchRequest = {
  init: GenerateInit;
  rows: ReadonlyArray<{ rowNumber: number; values: Readonly<Record<string, string>> }>;
  pattern: string;
  extension: string;
  removeDiacritics?: boolean;
  folder: string;
  zipName: string;
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  /** Worker count. Default: see `defaultPoolSize`. */
  poolSize?: number;
};

/** Leave one core for the main process, which compresses the ZIP and serves the window. */
export const defaultPoolSize = () => Math.max(1, availableParallelism() - 1);

const KNOWN: ReadonlySet<string> = new Set<RowErrorCode>([
  "missing-tag",
  "font-missing",
  "text-too-long",
  "render-failed",
]);

/** Generate every row in a worker pool and write the files into one ZIP, in row order. */
export async function runBatch(request: BatchRequest, workerFile: string): Promise<ExportResult> {
  const size = request.poolSize ?? defaultPoolSize();
  const names = planFileNames(request.rows, request.pattern, {
    extension: request.extension,
    removeDiacritics: request.removeDiacritics,
    maxLength: maxNameLength(request.folder, basename(request.zipName, ".zip")),
  });
  const pool = new WorkerPool<GenerateJob, Uint8Array>(workerFile, size, request.init);
  try {
    return await exportZip({
      folder: request.folder,
      zipName: request.zipName,
      total: request.rows.length,
      concurrency: size * 2,
      signal: request.signal,
      onProgress: request.onProgress,
      produce: async (index) => {
        try {
          const data = await pool.run({ values: { ...request.rows[index]?.values } });
          return { name: names[index] as string, data };
        } catch (error) {
          const code =
            error instanceof JobError && KNOWN.has(error.code) ? error.code : "render-failed";
          throw new RowFailure(code as RowErrorCode);
        }
      },
    });
  } finally {
    await pool.terminate();
  }
}

export const workerFileIn = (directory: string) => join(directory, "generate-worker.js");
