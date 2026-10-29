import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Only the folders given below, so results do not depend on the machine. Must be set before the canvas module loads.
vi.hoisted(() => {
  process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
});

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { createGenerator } from "./generate-job";
import { createImageJobs, type ImageReply } from "./image-job";
import { renderImage } from "./render/render";
import type { ImageTemplate, TextBox } from "./render/types";

const FONTS = join(import.meta.dirname, "../../tests/fixtures/fonts");
const FAMILY = "Sheetstamp Test";

const background = () => {
  const canvas = createCanvas(400, 120);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 400, 120);
  return new Uint8Array(canvas.toBuffer("image/png"));
};

const box = (over: Partial<TextBox> = {}): TextBox => ({
  field: "ten",
  x: 10,
  y: 10,
  width: 380,
  fontSize: 32,
  fontFamily: FAMILY,
  style: "normal",
  color: "#000000",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
  ...over,
});

const families = (reply: ImageReply) => {
  if (reply.kind !== "fonts") throw new Error("not a font reply");
  return reply.families;
};

describe("image jobs: fonts", () => {
  it("lists a family with only the styles that have a face, and sees a font installed later", async () => {
    const folder = mkdtempSync(join(tmpdir(), "sheetstamp-image-fonts-"));
    const jobs = createImageJobs({ fontFolders: [folder], systemFonts: false });
    expect(families(await jobs({ kind: "fonts" }))).toEqual([]);

    copyFileSync(join(FONTS, "SheetstampTest-Regular.ttf"), join(folder, "a.ttf"));
    expect(families(await jobs({ kind: "fonts" }))).toEqual([
      { family: FAMILY, styles: ["normal"] },
    ]);

    copyFileSync(join(FONTS, "SheetstampTest-BoldItalic.ttf"), join(folder, "b.ttf"));
    expect(families(await jobs({ kind: "fonts" }))).toEqual([
      { family: FAMILY, styles: ["normal", "bolditalic"] },
    ]);
  });
});

describe("image jobs: render", () => {
  beforeAll(() => {
    GlobalFonts.registerFromPath(join(FONTS, "SheetstampTest-Regular.ttf"));
  });
  const jobs = createImageJobs({ fontFolders: [], systemFonts: false });
  const values = { ten: "Nguyễn Thị Hương Đặng" };
  const template: ImageTemplate = { background: background(), boxes: [box()] };

  it("returns the same bytes as the export render and the export worker", async () => {
    const reply = await jobs({ kind: "render", template, values });
    if (reply.kind !== "render" || !reply.ok) throw new Error("render failed");
    expect(
      Buffer.from(reply.png).equals(Buffer.from((await renderImage(template, values)).data)),
    ).toBe(true);
    const exported = await createGenerator({ kind: "image", template, format: { type: "png" } })({
      values,
    });
    expect(Buffer.from(reply.png).equals(Buffer.from(exported))).toBe(true);
  });

  it("answers font-missing with the family, for a font that is no longer installed", async () => {
    const key = GlobalFonts.registerFromPath(
      join(FONTS, "SheetstampTest-Regular.ttf"),
      "Gone Soon",
    );
    const gone = { background: template.background, boxes: [box({ fontFamily: "Gone Soon" })] };
    const before = await jobs({ kind: "render", template: gone, values });
    expect(before).toMatchObject({ ok: true });

    expect(GlobalFonts.remove(key as NonNullable<typeof key>)).toBe(true);
    expect(await jobs({ kind: "render", template: gone, values })).toEqual({
      kind: "render",
      ok: false,
      code: "font-missing",
      field: "Gone Soon",
    });
    expect(families(await jobs({ kind: "fonts" })).map((f) => f.family)).not.toContain("Gone Soon");
  });

  it("answers text-too-long with the field and bad-background as codes, not exceptions", async () => {
    const strict = { background: template.background, boxes: [box({ overflow: "error" })] };
    expect(
      await jobs({ kind: "render", template: strict, values: { ten: "x".repeat(400) } }),
    ).toMatchObject({
      ok: false,
      code: "text-too-long",
      field: "ten",
    });
    const broken = { background: new Uint8Array([1, 2, 3]), boxes: [box()] };
    expect(await jobs({ kind: "render", template: broken, values })).toMatchObject({
      ok: false,
      code: "bad-background",
    });
  });
});
