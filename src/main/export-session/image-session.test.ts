import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileOf } from "../../../tests/e2e/file-of";
import type { DataTable } from "../data";
import type { BatchRequest } from "../export/batch";
import { openStorage, type Storage } from "../storage";
import { ExportSession, type SessionDeps } from "./session";

const background = (type: "png" | "jpeg") => {
  const canvas = createCanvas(120, 60);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 120, 60);
  return type === "png" ? canvas.toBuffer("image/png") : canvas.toBuffer("image/jpeg");
};

const box = (id: string, field: string, fontFamily = "Sheetstamp Test") => ({
  id,
  field,
  x: 4,
  y: 4,
  width: 100,
  fontSize: 16,
  fontFamily,
  style: "normal" as const,
  color: "#000000",
  align: "left" as const,
  maxLines: 1,
  overflow: "error" as const,
});

const table: DataTable = {
  fileName: "x.csv",
  columns: ["Họ tên"],
  rows: [["Nguyễn Văn An"], ["Trần\u0001Bình"], ["Lê Minh Châu"]],
  numericColumns: [false],
};

describe("ExportSession with image templates", () => {
  let dir: string;
  let storage: Storage;
  let requests: BatchRequest[];
  let missing: string[];
  let sizes: number[];
  let sampled: { rows: Record<string, string>[]; format: unknown }[];

  const deps = (): SessionDeps => ({
    storage: async () => storage,
    table: () => table,
    run: async (request) => {
      requests.push(request);
      return {
        zipPath: join(request.folder, request.zipName),
        written: request.rows.length,
        failed: [],
      };
    },
    defaultFolder: () => join(dir, "documents"),
    onProgress: () => undefined,
    now: () => new Date(2026, 9, 29),
    fonts: () => ({ fontFolders: ["/fonts"], systemFonts: false }),
    missingFonts: async () => missing,
    sample: async (_template, rows, format) => {
      sampled.push({ rows, format });
      return sizes;
    },
  });

  async function image(
    name: string,
    source: Buffer,
    boxes: ReturnType<typeof box>[] = [box("a", "ho_ten")],
  ) {
    const file = join(dir, `${name}.bin`);
    await writeFile(file, source);
    const made = await storage.createTemplate({
      name,
      kind: "image",
      imageLayout: { version: 1, boxes },
      tags: boxes.length === 0 ? [] : [{ name: "ho_ten", label: "Họ tên" }],
      mapping: { ho_ten: { kind: "column", column: "Họ tên" } },
      source: fileOf(file),
    });
    return made.id;
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sheetstamp-image-session-"));
    await mkdir(join(dir, "documents"));
    storage = await openStorage(join(dir, "data"));
    requests = [];
    missing = [];
    sizes = [];
    sampled = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("preselects the format of the background, and the remembered choice wins", async () => {
    const png = await image("png", background("png"));
    const jpg = await image("jpg", background("jpeg"));
    const session = new ExportSession(deps());
    expect(await session.open(png)).toMatchObject({
      ok: true,
      view: { kind: "image", imageFormat: "png", blocker: null },
    });
    expect(await session.open(jpg)).toMatchObject({ view: { imageFormat: "jpg" } });
    await storage.setChoices({ imageFormat: "png" });
    expect(await session.open(jpg)).toMatchObject({ view: { imageFormat: "png" } });
  });

  it("shows the extension of the chosen format in the example", async () => {
    const id = await image("png", background("png"));
    const session = new ExportSession(deps());
    const ask = (imageFormat?: "png" | "jpg") =>
      session.example({
        templateId: id,
        pattern: "{{ho_ten}}",
        removeDiacritics: false,
        imageFormat,
      });
    expect(await ask("jpg")).toMatchObject({ example: "Nguyễn Văn An.jpg" });
    expect(await ask("png")).toMatchObject({ example: "Nguyễn Văn An.png" });
    expect(await ask()).toMatchObject({ example: "Nguyễn Văn An.png" });
  });

  it("starts the batch with the chosen format, JPG quality 90, the fonts and no Word-only row check", async () => {
    const id = await image("png", background("png"));
    const result = await new ExportSession(deps()).start({
      templateId: id,
      pattern: "{{ho_ten}}",
      removeDiacritics: false,
      imageFormat: "jpg",
    });
    expect(result).toMatchObject({ ok: true, done: { written: 3, failed: 0 } });
    const [request] = requests;
    expect(request?.extension).toBe(".jpg");
    expect(request?.init).toMatchObject({
      kind: "image",
      format: { type: "jpeg", quality: 90 },
      fonts: { fontFolders: ["/fonts"], systemFonts: false },
    });
    // The control character in row 2 would break a Word file; an image just draws it.
    expect(request?.rows.some((row) => row.invalid)).toBe(false);
  });

  it("uses PNG output with the .png extension", async () => {
    const id = await image("jpg", background("jpeg"));
    await new ExportSession(deps()).start({
      templateId: id,
      pattern: "{{ho_ten}}",
      removeDiacritics: false,
      imageFormat: "png",
    });
    expect(requests[0]?.extension).toBe(".png");
    expect(requests[0]?.init).toMatchObject({ kind: "image", format: { type: "png" } });
  });

  it("refuses up front, with one blocker, when there are no boxes, the background is unreadable or a font is missing", async () => {
    const empty = await image("empty", background("png"), []);
    const broken = await image("broken", Buffer.from("not an image at all"));
    const font = await image("font", background("png"), [box("a", "ho_ten", "Gone")]);
    missing = [];
    const session = new ExportSession(deps());
    expect(await session.open(empty)).toMatchObject({ view: { blocker: { kind: "no-boxes" } } });
    expect(await session.open(broken)).toMatchObject({
      view: { blocker: { kind: "bad-template" } },
    });
    missing = ["Gone"];
    expect(await session.open(font)).toMatchObject({
      view: { blocker: { kind: "font-missing", fonts: ["Gone"] } },
    });

    const start = (templateId: string) =>
      session.start({ templateId, pattern: "fixed", removeDiacritics: false });
    expect(await start(empty)).toEqual({ ok: false, code: "no-boxes" });
    expect(await start(broken)).toEqual({ ok: false, code: "bad-template" });
    expect(await start(font)).toEqual({ ok: false, code: "font-missing", fonts: ["Gone"] });
    expect(requests).toEqual([]);
    expect(await session.estimate({ templateId: font, imageFormat: "png" })).toEqual({
      ok: false,
      code: "font-missing",
    });
  });

  it("estimates the total from the mean of the sample rows, and says nothing when none could be drawn", async () => {
    const id = await image("png", background("png"));
    const session = new ExportSession(deps());
    sizes = [1000, 3000];
    expect(await session.estimate({ templateId: id, imageFormat: "jpg" })).toEqual({
      ok: true,
      bytes: 6000, // mean 2000 x 3 rows
    });
    expect(sampled[0]?.rows).toEqual([{ ho_ten: "Nguyễn Văn An" }, { ho_ten: "Trần\u0001Bình" }]);
    expect(sampled[0]?.format).toEqual({ type: "jpeg", quality: 90 });
    sizes = [];
    expect(await session.estimate({ templateId: id, imageFormat: "png" })).toEqual({
      ok: true,
      bytes: null,
    });
    expect(sampled[1]?.format).toEqual({ type: "png" });
  });

  it("reports a worker failure while estimating as an unknown failure, not a crash", async () => {
    const id = await image("png", background("png"));
    const failing = deps();
    failing.sample = vi.fn().mockRejectedValue(new Error("worker died"));
    expect(
      await new ExportSession(failing).estimate({ templateId: id, imageFormat: "png" }),
    ).toEqual({
      ok: false,
      code: "unknown",
    });
  });
});
