import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LayoutBox } from "../../shared/image-layout";
import { openStorage, type Storage, UNGROUPED_ID } from "../storage";
import { previewImageReplace, updateImageTemplate } from "./image-edit";

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
const box = (id: string, field: string, x: number, y: number): LayoutBox => ({
  id,
  field,
  x,
  y,
  width: 100,
  fontFamily: "sans-serif",
  style: "normal",
  fontSize: 20,
  color: "#000000",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
});

async function seed() {
  const made = await storage.createTemplate({
    name: "Thư mời",
    kind: "image",
    source: { bytes: pngHeader(400, 300), fileName: "nen.png" },
    imageLayout: {
      version: 1,
      boxes: [box("a", "ho_ten", 10, 10), box("b", "ngay", 250, 10), box("c", "dia_chi", 10, 250)],
    },
    tags: [
      { name: "ho_ten", label: "Họ tên" },
      { name: "ngay", label: "Ngày" },
      { name: "dia_chi", label: "Địa chỉ" },
    ],
    filenamePattern: "{{ho_ten}}",
    mapping: { ho_ten: { kind: "column", column: "Tên" } },
  });
  return made.id;
}
const request = (id: string, replacePath: string | null = null) => ({
  id,
  name: "Thư mời mới",
  groupId: UNGROUPED_ID,
  note: " ghi chú ",
  filenamePattern: "{{ho_ten}}_{{ngay}}",
  replacePath,
});

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-image-edit-"));
  storage = await openStorage(path.join(root, "data"));
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

describe("previewImageReplace", () => {
  it("lists boxes cut by a smaller image as partly or outside, others are not listed", async () => {
    const id = await seed();
    const small = await write("nho.png", pngHeader(300, 200));
    const result = await previewImageReplace(storage, id, small);
    expect(result).toEqual({
      ok: true,
      value: {
        fileName: "nho.png",
        width: 300,
        height: 200,
        large: false,
        boxCount: 3,
        outside: [
          { id: "b", field: "ngay", label: "Ngày", fit: "partly" },
          { id: "c", field: "dia_chi", label: "Địa chỉ", fit: "outside" },
        ],
      },
    });
  });

  it("applies the create checks to the new file", async () => {
    const id = await seed();
    const gif = await write("anh.png", "GIF89a\x01\x00\x01\x00");
    expect(await previewImageReplace(storage, id, gif)).toMatchObject({ ok: false });
  });
});

describe("updateImageTemplate", () => {
  it("edits name, group, note and pattern without touching layout, tags or mapping", async () => {
    const id = await seed();
    const before = await storage.getTemplate(id);
    expect(await updateImageTemplate(storage, request(id))).toEqual({ ok: true, value: { id } });
    const after = await storage.getTemplate(id);
    expect(after).toMatchObject({
      name: "Thư mời mới",
      note: "ghi chú",
      filenamePattern: "{{ho_ten}}_{{ngay}}",
    });
    expect(after?.imageLayout).toEqual(before?.imageLayout);
    expect(after?.tags).toEqual(before?.tags);
    expect(after?.mapping).toEqual(before?.mapping);
    expect(after?.sourceCopy).toBe(before?.sourceCopy);
  });

  it("refuses a pattern with an unknown field and changes nothing", async () => {
    const id = await seed();
    const result = await updateImageTemplate(storage, {
      ...request(id),
      filenamePattern: "{{khong_co}}",
    });
    expect(result).toMatchObject({ ok: false });
    expect((await storage.getTemplate(id))?.name).toBe("Thư mời");
  });

  it("replaces the background, keeps the layout, and leaves one stored copy", async () => {
    const id = await seed();
    const before = await storage.getTemplate(id);
    const small = await write("nho.png", pngHeader(300, 200));
    expect((await updateImageTemplate(storage, request(id, small))).ok).toBe(true);
    const after = await storage.getTemplate(id);
    expect(after?.sourceFileName).toBe("nho.png");
    expect(after?.sourceCopy).not.toBe(before?.sourceCopy);
    expect(after?.imageLayout).toEqual(before?.imageLayout);
    expect(after?.mapping).toEqual(before?.mapping);
    expect((await storage.readSource(id)).equals(pngHeader(300, 200))).toBe(true);
    expect(await fsp.readdir(path.join(root, "data", "sources"))).toHaveLength(1);
  });

  it("a bad new image leaves the old image and record in place", async () => {
    const id = await seed();
    const before = await storage.getTemplate(id);
    const gif = await write("anh.png", "GIF89a\x01\x00\x01\x00");
    expect(await updateImageTemplate(storage, request(id, gif))).toMatchObject({ ok: false });
    expect(await storage.getTemplate(id)).toEqual(before);
    expect((await storage.readSource(id)).equals(pngHeader(400, 300))).toBe(true);
    expect(await fsp.readdir(path.join(root, "data", "sources"))).toHaveLength(1);
  });

  it("refuses a Word template", async () => {
    const made = await storage.createTemplate({
      name: "W",
      kind: "word",
      source: { bytes: Buffer.from("x"), fileName: "w.docx" },
    });
    expect(await updateImageTemplate(storage, request(made.id))).toMatchObject({ ok: false });
  });
});
