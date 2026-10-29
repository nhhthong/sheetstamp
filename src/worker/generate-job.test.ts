import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
});

import { join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { makeDocx, paragraph, run, textOf } from "../main/selftest/make-docx";
import { createGenerator } from "./generate-job";
import type { ImageTemplate } from "./render/types";

const FONTS = join(import.meta.dirname, "../../tests/fixtures/fonts");
GlobalFonts.registerFromPath(join(FONTS, "SheetstampTest-Regular.ttf"));

const background = () => {
  const canvas = createCanvas(400, 120);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 400, 120);
  return new Uint8Array(canvas.toBuffer("image/png"));
};

const imageTemplate = (fontFamily: string): ImageTemplate => ({
  background: background(),
  boxes: [
    {
      field: "ten",
      x: 10,
      y: 10,
      width: 380,
      fontSize: 32,
      fontFamily,
      style: "normal",
      color: "#000000",
      align: "left",
      maxLines: 1,
      overflow: "error",
    },
  ],
});

describe("createGenerator: word", () => {
  it("fills a template", async () => {
    const template = await makeDocx({ body: paragraph(run("Xin chào {{ten}}")) });
    const generate = createGenerator({ kind: "word", template });
    const data = await generate({ values: { ten: "Hương" } });
    expect(await textOf(data, "word/document.xml")).toBe("Xin chào Hương");
  });

  it("fails the row with `missing-tag` when a value is absent", async () => {
    const template = await makeDocx({ body: paragraph(run("{{ten}} {{chuc_vu}}")) });
    const generate = createGenerator({ kind: "word", template });
    await expect(generate({ values: { ten: "A" } })).rejects.toMatchObject({ code: "missing-tag" });
  });

  it("fails the row with `render-failed` for a broken template", async () => {
    const generate = createGenerator({ kind: "word", template: new Uint8Array([1, 2, 3]) });
    await expect(generate({ values: {} })).rejects.toMatchObject({ code: "render-failed" });
  });
});

describe("createGenerator: image", () => {
  it("draws a row", async () => {
    const generate = createGenerator({
      kind: "image",
      template: imageTemplate("Sheetstamp Test"),
      format: { type: "png" },
    });
    const data = await generate({ values: { ten: "Nguyễn Thị Hương" } });
    expect([...data.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("fails the row with `bad-background` when the background cannot be read", async () => {
    const generate = createGenerator({
      kind: "image",
      template: { ...imageTemplate("Sheetstamp Test"), background: new Uint8Array([1, 2, 3]) },
      format: { type: "png" },
    });
    await expect(generate({ values: { ten: "A" } })).rejects.toMatchObject({
      code: "bad-background",
    });
  });

  it("writes a JPEG when asked", async () => {
    const generate = createGenerator({
      kind: "image",
      template: imageTemplate("Sheetstamp Test"),
      format: { type: "jpeg", quality: 90 },
    });
    const data = await generate({ values: { ten: "Hương" } });
    expect([...data.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it.each([
    ["Gone Font", { ten: "A" }, "font-missing"],
    ["Sheetstamp Test", { ten: "x".repeat(200) }, "text-too-long"],
  ])("fails the row with %s as `%s`", async (family, values, code) => {
    const generate = createGenerator({
      kind: "image",
      template: imageTemplate(family),
      format: { type: "png" },
    });
    await expect(generate({ values })).rejects.toMatchObject({ code });
  });
});
