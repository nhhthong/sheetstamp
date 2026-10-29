import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DataTable } from "../data";
import { makeDocx, paragraph, run } from "../selftest/make-docx";
import { openStorage, type Storage } from "../storage";
import {
  getMappingRow,
  imageSource,
  mappingMessages,
  openMapping,
  setMappingEntry,
  templateBytes,
} from "./session";

let root: string;
let storage: Storage;
let id: string;

const table = (columns: string[], rows: string[][] = [["a", "b", "c"]]): DataTable => ({
  fileName: "x.csv",
  columns,
  rows,
  numericColumns: columns.map(() => false),
});

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-mapping-"));
  storage = await openStorage(path.join(root, "data"));
  const source = path.join(root, "mau.docx");
  await fsp.writeFile(source, await makeDocx({ body: paragraph(run("{{ho_ten}} {{ly_do}}")) }));
  const made = await storage.createTemplate({
    name: "Mẫu",
    kind: "word",
    source: { bytes: await fsp.readFile(source), fileName: "mau.docx" },
    tags: [
      { name: "ho_ten", label: "Họ và tên" },
      { name: "ly_do", label: "Lý do" },
    ],
  });
  id = made.id;
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

describe("openMapping", () => {
  it("matches, saves the flat record and lists what is left", async () => {
    const opened = await openMapping(storage, table(["Họ tên", "Khác"]), id);
    expect(opened.ok && opened.view.unmatched).toEqual(["ly_do"]);
    const stored = (await storage.getTemplate(id))?.mapping;
    expect(stored).toEqual({ ho_ten: { kind: "column", column: "Họ tên" } });
  });

  it("keeps valid choices, reports the lost column and saves the new state", async () => {
    await openMapping(storage, table(["Họ tên", "Lý do"]), id);
    const again = await openMapping(storage, table(["Họ tên", "Khác"]), id);
    expect(again.ok && again.view.lost).toEqual([
      { field: "ly_do", previous: "Lý do", replacedBy: null },
    ]);
    expect(again.ok && again.view.unmatched).toEqual(["ly_do"]);
    expect((await storage.getTemplate(id))?.mapping).toEqual({
      ho_ten: { kind: "column", column: "Họ tên" },
    });
  });

  it("has nothing to fix the second time with the same data", async () => {
    const data = table(["Họ tên", "Khác"]);
    await openMapping(storage, data, id);
    await setMappingEntry(storage, data, {
      templateId: id,
      key: "ly_do",
      entry: { kind: "fixed", text: "Hết hạn" },
    });
    const again = await openMapping(storage, data, id);
    expect(again.ok && again.view.unmatched).toEqual([]);
    expect(again.ok && again.view.lost).toEqual([]);
  });

  it("refuses without data and for a missing template", async () => {
    expect(await openMapping(storage, undefined, id)).toEqual({
      ok: false,
      message: mappingMessages.noData,
    });
    expect(await openMapping(storage, table(["a"]), "nope")).toEqual({
      ok: false,
      message: mappingMessages.missing,
    });
  });
});

describe("setMappingEntry", () => {
  const data = table(["Họ tên", "Khác"]);
  const set = (key: string, entry: Parameters<typeof setMappingEntry>[2]["entry"]) =>
    setMappingEntry(storage, data, { templateId: id, key, entry });

  it("saves column, fixed and empty, and clears with null", async () => {
    expect(await set("ho_ten", { kind: "column", column: "Khác" })).toMatchObject({ ok: true });
    await set("ly_do", { kind: "empty" });
    expect((await storage.getTemplate(id))?.mapping).toEqual({
      ho_ten: { kind: "column", column: "Khác" },
      ly_do: { kind: "empty" },
    });
    await set("ly_do", null);
    expect((await storage.getTemplate(id))?.mapping).toEqual({
      ho_ten: { kind: "column", column: "Khác" },
    });
  });

  it("refuses an unknown tag, an unknown column and a long fixed text", async () => {
    expect(await set("la", { kind: "empty" })).toEqual({
      ok: false,
      message: mappingMessages.badField,
    });
    expect(await set("ho_ten", { kind: "column", column: "Không có" })).toEqual({
      ok: false,
      message: mappingMessages.badColumn,
    });
    expect(await set("ho_ten", { kind: "fixed", text: "x".repeat(1001) })).toEqual({
      ok: false,
      message: mappingMessages.tooLong,
    });
    expect((await storage.getTemplate(id))?.mapping).toEqual({});
  });

  it("keeps quick saves in order", async () => {
    await Promise.all([
      set("ho_ten", { kind: "column", column: "Khác" }),
      set("ly_do", { kind: "fixed", text: "a" }),
      set("ly_do", { kind: "fixed", text: "ab" }),
    ]);
    expect((await storage.getTemplate(id))?.mapping).toEqual({
      ho_ten: { kind: "column", column: "Khác" },
      ly_do: { kind: "fixed", text: "ab" },
    });
  });
});

describe("getMappingRow and templateBytes", () => {
  it("returns one row and refuses out of range", () => {
    const data = table(
      ["a", "b"],
      [
        ["1", "2"],
        ["3", "4"],
      ],
    );
    expect(getMappingRow(data, 1)).toEqual({ ok: true, cells: ["3", "4"] });
    expect(getMappingRow(data, 2)).toEqual({ ok: false, message: mappingMessages.badRow });
    expect(getMappingRow(undefined, 0)).toEqual({ ok: false, message: mappingMessages.noData });
  });
  it("reads the stored copy", async () => {
    const result = await templateBytes(storage, id);
    expect(result.ok && result.docx.byteLength).toBeGreaterThan(100);
    expect(await templateBytes(storage, "nope")).toMatchObject({ ok: false });
  });
});

describe("image templates", () => {
  const box = (id: string, field: string) => ({
    id,
    field,
    x: 1,
    y: 2,
    width: 100,
    fontSize: 20,
    fontFamily: "Arial",
    style: "normal",
    color: "#000000",
    align: "left",
    maxLines: 1,
    overflow: "shrink",
  });
  const make = (boxes: ReturnType<typeof box>[]) =>
    storage.createTemplate({
      name: "Ảnh",
      kind: "image",
      imageLayout: { version: 1, boxes },
      tags: [...new Set(boxes.map((b) => b.field))].map((name) => ({ name, label: name })),
      source: { bytes: Uint8Array.from([1, 2, 3]), fileName: "nen.png" },
    });

  it("maps the fields of the boxes and saves the profile like a Word template", async () => {
    const made = await make([box("a", "ho_ten"), box("b", "ho_ten"), box("c", "ly_do")]);
    const data = table(["Họ tên", "Khác"]);
    const opened = await openMapping(storage, data, made.id);
    expect(opened.ok && opened.view.kind).toBe("image");
    expect(opened.ok && opened.view.fields.map((f) => f.key)).toEqual(["ho_ten", "ly_do"]);
    expect(opened.ok && opened.view.unmatched).toEqual(["ly_do"]);
    const set = await setMappingEntry(storage, data, {
      templateId: made.id,
      key: "ly_do",
      entry: { kind: "empty" },
    });
    expect(set.ok).toBe(true);
    const again = await openMapping(storage, data, made.id);
    expect(again.ok && again.view.unmatched).toEqual([]);
  });

  it("gives the boxes without ids and the background", async () => {
    const made = await make([box("a", "ho_ten")]);
    const source = await imageSource(storage, made.id);
    expect(source.ok && [...source.background]).toEqual([1, 2, 3]);
    expect(source.ok && "id" in (source.boxes[0] ?? {})).toBe(false);
    expect(source.ok && source.boxes[0]?.field).toBe("ho_ten");
  });

  it("refuses a template without boxes, in both calls", async () => {
    const made = await make([]);
    const refusal = { ok: false, message: mappingMessages.noBoxes };
    expect(await openMapping(storage, table(["a"]), made.id)).toEqual(refusal);
    expect(await imageSource(storage, made.id)).toEqual(refusal);
  });

  it("does not give an image to a Word call and the other way round", async () => {
    const made = await make([box("a", "ho_ten")]);
    expect(await templateBytes(storage, made.id)).toMatchObject({ ok: false });
    expect(await imageSource(storage, id)).toEqual({
      ok: false,
      message: mappingMessages.notImage,
    });
  });
});
