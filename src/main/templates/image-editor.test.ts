import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyImageLayout } from "../../shared/image-layout";
import type { DataTable } from "../data";
import { openStorage, type Storage } from "../storage";
import { editorMessages, openImageEditor, sampleRow, saveImageLayout } from "./image-editor";
import { listTemplates } from "./library";

let root: string;
let storage: Storage;
let id: string;

const box = (n: number, field: string) => ({
  id: `b${n}`,
  field,
  x: 10 * n,
  y: 20,
  width: 300,
  fontSize: 40,
  fontFamily: "Test Sans",
  style: "normal",
  color: "#1a1a1a",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
});

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-image-editor-"));
  storage = await openStorage(path.join(root, "data"));
  const created = await storage.createTemplate({
    name: "Giấy khen",
    kind: "image",
    imageLayout: emptyImageLayout(),
    source: { bytes: Uint8Array.from([1, 2, 3]), fileName: "nen.png" },
  });
  id = created.id;
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

describe("image editor open and save", () => {
  it("opens with the stored bytes and an empty layout", async () => {
    const result = await openImageEditor(storage, id);
    expect(result).toMatchObject({ ok: true, value: { name: "Giấy khen", labels: {} } });
    if (result.ok) {
      expect([...result.value.background]).toEqual([1, 2, 3]);
      expect(result.value.layout.boxes).toEqual([]);
    }
  });

  it("saves layout and one tag per distinct field in one record, and the library counts them", async () => {
    const layout = { version: 1, boxes: [box(1, "ho_ten"), box(2, "ho_ten"), box(3, "don_vi")] };
    const saved = await saveImageLayout(storage, {
      id,
      layout,
      labels: { ho_ten: "Họ và tên", don_vi: "Đơn vị" },
    });
    expect(saved).toEqual({ ok: true, value: undefined });
    const reopened = await openImageEditor(storage, id);
    expect(reopened).toMatchObject({
      ok: true,
      value: { layout, labels: { ho_ten: "Họ và tên", don_vi: "Đơn vị" } },
    });
    expect((await listTemplates(storage))[0]?.tagCount).toBe(2);
  });

  it("refuses an invalid layout without touching the record", async () => {
    const bad = { version: 1, boxes: [{ ...box(1, "ten"), width: -5 }] };
    expect(await saveImageLayout(storage, { id, layout: bad, labels: {} })).toEqual({
      ok: false,
      message: editorMessages.badLayout,
    });
    expect((await storage.getTemplate(id))?.tags).toEqual([]);
  });

  it("refuses a newer layout and an unknown or Word template", async () => {
    expect(
      await saveImageLayout(storage, { id, layout: { version: 9, boxes: [] }, labels: {} }),
    ).toEqual({ ok: false, message: editorMessages.newer });
    expect(await openImageEditor(storage, "nope")).toEqual({
      ok: false,
      message: editorMessages.notFound,
    });
    const word = await storage.createTemplate({
      name: "w",
      kind: "word",
      source: { bytes: Uint8Array.from([1]), fileName: "w.docx" },
    });
    expect(await openImageEditor(storage, word.id)).toMatchObject({ ok: false });
  });

  it("falls back to a readable label from the key when none is sent", async () => {
    await saveImageLayout(storage, {
      id,
      layout: { version: 1, boxes: [box(1, "ho_ten")] },
      labels: {},
    });
    expect((await storage.getTemplate(id))?.tags).toEqual([{ name: "ho_ten", label: "Ho ten" }]);
  });
});

describe("sampleRow", () => {
  const table: DataTable = {
    fileName: "ds.csv",
    columns: ["Họ tên", "Phòng ban", "Ghi chú"],
    rows: [
      ["Nguyễn Văn An", "Kế toán", "x"],
      ["Trần Thị Bình", "Nhân sự", "y"],
    ],
    numericColumns: [false, false, false],
  };
  const fields = [
    { key: "ho_ten", label: "Họ và tên" },
    { key: "so_quyet_dinh", label: "Số quyết định" },
  ];

  it("gives the first row's cell for a field whose column matches, and nothing for the others", () => {
    expect(sampleRow(table, fields)).toEqual({
      hasData: true,
      values: { ho_ten: "Nguyễn Văn An" },
    });
  });

  it("reports no data when nothing is loaded", () => {
    expect(sampleRow(undefined, fields)).toEqual({ hasData: false, values: {} });
  });
});
