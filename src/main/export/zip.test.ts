import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorReportCsv } from "./report";
import { ExportCancelledError, exportZip, RowFailure, type ZipEntry } from "./zip";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "sheetstamp-zip-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const entry = (i: number): ZipEntry => ({
  name: `Nguyễn ${i}.docx`,
  data: new Uint8Array(Buffer.from(`file ${i}`)),
});
const names = async (zipPath: string) =>
  Object.keys((await JSZip.loadAsync(await readFile(zipPath))).files);

describe("exportZip", () => {
  it("writes every file with UTF-8 names and leaves no temporary file", async () => {
    const result = await exportZip({
      folder,
      zipName: "dot-1.zip",
      total: 5,
      produce: async (i) => entry(i),
    });
    expect(result.written).toBe(5);
    expect(result.failed).toEqual([]);
    expect(result.reportPath).toBeUndefined();
    expect(await names(result.zipPath)).toEqual([0, 1, 2, 3, 4].map((i) => `Nguyễn ${i}.docx`));
    expect(await readdir(folder)).toEqual(["dot-1.zip"]);
  });

  it("sets the UTF-8 flag on non-ASCII names", async () => {
    const result = await exportZip({
      folder,
      zipName: "a.zip",
      total: 1,
      produce: async () => entry(7),
    });
    const bytes = await readFile(result.zipPath);
    const flags = bytes.readUInt16LE(6); // general purpose bit flag of the first local header
    expect(flags & 0x800).toBe(0x800);
  });

  it("keeps going when a row fails and reports row numbers only", async () => {
    const result = await exportZip({
      folder,
      zipName: "dot.zip",
      total: 4,
      produce: async (i) => {
        if (i === 1) throw new RowFailure("missing-tag");
        if (i === 2) throw new Error("secret data: Nguyễn Văn A");
        return entry(i);
      },
    });
    expect(result.written).toBe(2);
    expect(result.failed).toEqual([
      { row: 2, code: "missing-tag" },
      { row: 3, code: "render-failed" },
    ]);
    expect(result.reportPath).toBeDefined();
    const report = await readFile(result.reportPath as string, "utf8");
    expect(report).toBe("row,error_code\r\n2,missing-tag\r\n3,render-failed\r\n");
    expect(report).not.toContain("Nguyễn");
  });

  it("removes the temporary file and creates no ZIP when cancelled", async () => {
    const controller = new AbortController();
    const promise = exportZip({
      folder,
      zipName: "huy.zip",
      total: 50,
      signal: controller.signal,
      produce: async (i) => {
        if (i === 3) controller.abort();
        return entry(i);
      },
    });
    await expect(promise).rejects.toBeInstanceOf(ExportCancelledError);
    expect(await readdir(folder)).toEqual([]);
  });

  it("cleans up on an error that is not a row error", async () => {
    const promise = exportZip({
      folder,
      zipName: "loi.zip",
      total: 3,
      produce: async (i) => {
        if (i === 1) throw new ExportCancelledError(); // stands in for any fatal error
        return entry(i);
      },
    });
    await expect(promise).rejects.toThrow();
    expect(await readdir(folder)).toEqual([]);
  });

  it("never overwrites an existing ZIP or report", async () => {
    const run = () =>
      exportZip({ folder, zipName: "dot.zip", total: 1, produce: async () => entry(1) });
    await run();
    const second = await run();
    expect(second.zipPath.endsWith("dot (2).zip")).toBe(true);
    expect((await readdir(folder)).sort()).toEqual(["dot (2).zip", "dot.zip"]);
  });

  it("reports progress after each file", async () => {
    const seen: number[] = [];
    await exportZip({
      folder,
      zipName: "p.zip",
      total: 3,
      produce: async (i) => entry(i),
      onProgress: (p) => seen.push(p.done),
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it("creates the destination folder when it does not exist yet", async () => {
    const nested = join(folder, "a", "b");
    const result = await exportZip({
      folder: nested,
      zipName: "n.zip",
      total: 1,
      produce: async () => entry(1),
    });
    expect(existsSync(result.zipPath)).toBe(true);
  });
});

describe("errorReportCsv", () => {
  it("prefixes cells that start with =, +, - or @ with a tab", () => {
    const csv = errorReportCsv([
      { row: 1, code: "=evil" as never },
      { row: 2, code: "@x" as never },
    ]);
    expect(csv).toBe("row,error_code\r\n1,\t=evil\r\n2,\t@x\r\n");
  });

  it("leaves ordinary cells alone", () => {
    expect(errorReportCsv([{ row: 7, code: "unknown" }])).toBe("row,error_code\r\n7,unknown\r\n");
  });
});

describe("exportZip concurrency", () => {
  it("produces several rows at once but writes them in row order", async () => {
    let running = 0;
    let peak = 0;
    const result = await exportZip({
      folder,
      zipName: "song-song.zip",
      total: 8,
      concurrency: 4,
      produce: async (i) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, (8 - i) * 5)); // later rows finish first
        running--;
        return entry(i);
      },
    });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(await names(result.zipPath)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `Nguyễn ${i}.docx`),
    );
  });

  it("still reports a failing row by its number", async () => {
    const result = await exportZip({
      folder,
      zipName: "loi.zip",
      total: 6,
      concurrency: 3,
      produce: async (i) => {
        if (i === 4) throw new RowFailure("text-too-long");
        return entry(i);
      },
    });
    expect(result.failed).toEqual([{ row: 5, code: "text-too-long" }]);
    expect(result.written).toBe(5);
  });
});
