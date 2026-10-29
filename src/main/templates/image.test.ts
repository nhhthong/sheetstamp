import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseImageLayout } from "../../shared/image-layout";
import { openStorage, type Storage, UNGROUPED_ID } from "../storage";
import { createImageTemplate, imageMessages, parseImageFile } from "./image";
import { listTemplates } from "./library";

let root: string;
let storage: Storage;

function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
const write = async (name: string, bytes: Buffer | string) => {
  const file = path.join(root, name);
  await fsp.writeFile(file, bytes);
  return file;
};

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-image-tpl-"));
  storage = await openStorage(path.join(root, "data"));
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

describe("parseImageFile", () => {
  it("accepts a PNG whatever its extension says", async () => {
    const file = await write("anh.dat", pngHeader(800, 600));
    expect(await parseImageFile(file)).toEqual({
      ok: true,
      value: { fileName: "anh.dat", width: 800, height: 600, large: false },
    });
  });

  it("refuses a renamed gif, a missing file and a relative path with a fix", async () => {
    const gif = await write("anh.png", "GIF89a\x01\x00\x01\x00");
    expect(await parseImageFile(gif)).toEqual({ ok: false, message: imageMessages["not-image"] });
    expect(await parseImageFile(path.join(root, "khong-co.png"))).toEqual({
      ok: false,
      message: imageMessages.unreadable,
    });
    expect(await parseImageFile("anh.png")).toMatchObject({ ok: false });
  });

  it("refuses a file over 20 MB without reading it", async () => {
    const big = await write("lon.png", Buffer.alloc(20 * 1024 * 1024 + 1));
    expect(await parseImageFile(big)).toEqual({ ok: false, message: imageMessages["too-big"] });
  });
});

describe("createImageTemplate", () => {
  it("stores a copy and an empty layout that keeps working after the original is gone", async () => {
    const file = await write("nen.png", pngHeader(100, 50));
    const result = await createImageTemplate(storage, {
      path: file,
      name: " Thư mời ",
      groupId: UNGROUPED_ID,
      note: "",
    });
    expect(result.ok).toBe(true);
    await fsp.rm(file);

    const [row] = await listTemplates(storage);
    expect(row).toMatchObject({
      name: "Thư mời",
      kind: "image",
      sourceFileName: "nen.png",
      tagCount: 0,
    });
    const stored = await storage.getTemplate(row?.id as string);
    expect(parseImageLayout(stored?.imageLayout)).toEqual({
      ok: true,
      layout: { version: 1, boxes: [] },
    });
    expect((await storage.readSource(row?.id as string)).equals(pngHeader(100, 50))).toBe(true);
  });

  it("checks the file again in main and stores nothing when it fails", async () => {
    const gif = await write("anh.png", "GIF89a\x01\x00\x01\x00");
    const result = await createImageTemplate(storage, {
      path: gif,
      name: "A",
      groupId: UNGROUPED_ID,
      note: "",
    });
    expect(result.ok).toBe(false);
    expect(await storage.listTemplates()).toEqual([]);
    expect(await fsp.readdir(path.join(root, "data", "sources"))).toEqual([]);
  });

  it("refuses an empty name and an unknown group", async () => {
    const file = await write("nen.png", pngHeader(10, 10));
    expect(
      await createImageTemplate(storage, {
        path: file,
        name: " ",
        groupId: UNGROUPED_ID,
        note: "",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await createImageTemplate(storage, { path: file, name: "A", groupId: "nope", note: "" }),
    ).toMatchObject({ ok: false });
  });

  it("lists a template whose stored layout is corrupt or newer, and the validator refuses both", async () => {
    const file = await write("nen.png", pngHeader(10, 10));
    for (const layout of [
      { version: 9, boxes: [] },
      { version: 1, boxes: "x" },
    ]) {
      const made = await storage.createTemplate({
        name: "X",
        kind: "image",
        imageLayout: layout,
        source: { bytes: pngHeader(10, 10), fileName: path.basename(file) },
      });
      expect(parseImageLayout((await storage.getTemplate(made.id))?.imageLayout).ok).toBe(false);
    }
    expect(await listTemplates(storage)).toHaveLength(2);
  });
});
