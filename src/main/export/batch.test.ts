import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDocx, paragraph, run, textOf } from "../selftest/make-docx";
import { runBatch, workerFileIn } from "./batch";
import { ExportCancelledError } from "./zip";

// Uses the real worker built by `npm run build`; skipped when the app has not been built.
const WORKER = workerFileIn(join(import.meta.dirname, "../../../out/main"));
const built = existsSync(WORKER);

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "sheetstamp-batch-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const rows = (count: number, mutate: (i: number) => Record<string, string> = () => ({})) =>
  Array.from({ length: count }, (_, i) => ({
    rowNumber: i + 1,
    values: { ten: `Nguyễn Văn ${i}`, ma: `${i}`.padStart(5, "0"), ...mutate(i) },
  }));

describe.skipIf(!built)("runBatch with the built worker", () => {
  it("fills 60 Word documents in parallel and zips them in order", async () => {
    const template = await makeDocx({ body: paragraph(run("Mã {{ma}}: {{t"), run("en}}")) });
    const result = await runBatch(
      {
        init: { kind: "word", template },
        rows: rows(60),
        pattern: "{{ma}}_{{ten}}",
        extension: "docx",
        folder,
        zipName: "dot-1.zip",
        poolSize: 3,
      },
      WORKER,
    );
    expect(result.written).toBe(60);
    expect(result.failed).toEqual([]);
    const zip = await JSZip.loadAsync(await readFile(result.zipPath));
    expect(Object.keys(zip.files)).toHaveLength(60);
    expect(Object.keys(zip.files)[7]).toBe("00007_Nguyễn Văn 7.docx");
    const doc = await zip.file("00007_Nguyễn Văn 7.docx")?.async("uint8array");
    expect(await textOf(doc as Uint8Array, "word/document.xml")).toBe("Mã 00007: Nguyễn Văn 7");
  });

  it("flags rows whose tag has no value", async () => {
    const template = await makeDocx({ body: paragraph(run("{{ten}} {{chuc_vu}}")) });
    const result = await runBatch(
      {
        init: { kind: "word", template },
        rows: rows(4).map((r) => ({ ...r, values: { ten: r.values.ten } })),
        pattern: "{{ten}}",
        extension: "docx",
        folder,
        zipName: "thieu.zip",
        poolSize: 2,
      },
      WORKER,
    );
    expect(result.written).toBe(0);
    expect(result.failed.map((f) => f.code)).toEqual(Array(4).fill("missing-tag"));
    expect(result.reportPath).toBeDefined();
  });

  it("stops all workers and leaves nothing behind when cancelled", async () => {
    const template = await makeDocx({ body: paragraph(run("{{ten}}")) });
    const controller = new AbortController();
    const promise = runBatch(
      {
        init: { kind: "word", template },
        rows: rows(2000),
        pattern: "{{ten}}",
        extension: "docx",
        folder,
        zipName: "huy.zip",
        poolSize: 2,
        signal: controller.signal,
        onProgress: (p) => {
          if (p.done === 20) controller.abort();
        },
      },
      WORKER,
    );
    await expect(promise).rejects.toBeInstanceOf(ExportCancelledError);
    expect(await readdir(folder)).toEqual([]);
  });
});
