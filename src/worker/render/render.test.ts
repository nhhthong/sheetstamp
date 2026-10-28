import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Only the test fonts, so results do not depend on the machine. Must be set before the canvas module loads.
vi.hoisted(() => {
  process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
});

import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import {
  availableStyles,
  hasFamily,
  listFamilies,
  missingFonts,
  refreshFonts,
  systemFontFolders,
} from "./fonts";
import { renderImage } from "./render";
import { type ImageTemplate, RenderError, type TextBox } from "./types";

const FONT_DIR = join(import.meta.dirname, "../../../tests/fixtures/fonts");
const GOLDEN = join(import.meta.dirname, "../../../tests/fixtures/image/golden");
for (const face of ["Regular", "Bold", "Italic", "BoldItalic"]) {
  GlobalFonts.registerFromPath(join(FONT_DIR, `SheetstampTest-${face}.ttf`));
}
// A family that only has a regular face.
GlobalFonts.registerFromPath(join(FONT_DIR, "SheetstampTest-Regular.ttf"), "Only Regular");

const FAMILY = "Sheetstamp Test";
const NAME = "Nguyễn Thị Hương Đặng Ngọc Ánh";

function background(width = 800, height = 300): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fdf6e3");
  gradient.addColorStop(1, "#d6e4f0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

const box = (over: Partial<TextBox> = {}): TextBox => ({
  field: "ten",
  x: 40,
  y: 40,
  width: 720,
  fontSize: 48,
  fontFamily: FAMILY,
  style: "normal",
  color: "#1a1a1a",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
  ...over,
});

const template = (...boxes: TextBox[]): ImageTemplate => ({ background: background(), boxes });

async function pixels(png: Uint8Array) {
  const image = await loadImage(Buffer.from(png));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: ctx.getImageData(0, 0, image.width, image.height).data,
  };
}

/** Share of pixels whose colour differs by more than 16 in any channel. */
async function difference(a: Uint8Array, b: Uint8Array): Promise<number> {
  const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
  if (pa.width !== pb.width || pa.height !== pb.height) return 1;
  let different = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.max(
      Math.abs((pa.data[i] as number) - (pb.data[i] as number)),
      Math.abs((pa.data[i + 1] as number) - (pb.data[i + 1] as number)),
      Math.abs((pa.data[i + 2] as number) - (pb.data[i + 2] as number)),
    );
    if (d > 16) different++;
  }
  return different / (pa.width * pa.height);
}

const blank = async (png: Uint8Array) => (await difference(png, background())) === 0;

describe("fonts", () => {
  it("lists installed families with only the styles that exist", () => {
    expect(availableStyles(FAMILY)).toEqual(["normal", "bold", "italic", "bolditalic"]);
    expect(availableStyles("Only Regular")).toEqual(["normal"]);
    expect(listFamilies().map((f) => f.family)).toEqual(["Only Regular", FAMILY]);
  });

  it("reports fonts a template uses that are not installed", () => {
    expect(
      missingFonts([
        { fontFamily: FAMILY },
        { fontFamily: "Gone Font" },
        { fontFamily: "Gone Font" },
      ]),
    ).toEqual(["Gone Font"]);
  });

  it("picks up a font installed while the app runs after a rescan", () => {
    const dir = mkdtempSync(join(tmpdir(), "sheetstamp-fonts-"));
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(FONT_DIR, "SheetstampTest-Bold.ttf"), join(dir, "Later.ttf"));
    expect(refreshFonts([dir, join(dir, "missing-folder")])).toBe(1);
    expect(refreshFonts([dir])).toBe(1); // loading the same folder again adds nothing new
    expect(availableStyles(FAMILY)).toEqual(["normal", "bold", "italic", "bolditalic"]);
  });

  it("knows where each operating system keeps fonts", () => {
    expect(
      systemFontFolders(
        { WINDIR: "C:\\Windows", LOCALAPPDATA: "C:\\U\\AppData\\Local" },
        "win32",
        "C:\\U",
      ),
    ).toEqual(["C:\\Windows\\Fonts", "C:\\U\\AppData\\Local\\Microsoft\\Windows\\Fonts"]);
    expect(systemFontFolders({}, "linux", "/home/a")).toContain("/home/a/.local/share/fonts");
    expect(systemFontFolders({}, "darwin", "/Users/a")).toContain("/Users/a/Library/Fonts");
  });
});

describe("renderImage", () => {
  it("draws Vietnamese text in all four styles", async () => {
    const shots = new Set<string>();
    for (const style of ["normal", "bold", "italic", "bolditalic"] as const) {
      const { data } = await renderImage(template(box({ style })), { ten: NAME });
      expect(await blank(data)).toBe(false);
      shots.add(Buffer.from(data).toString("base64"));
    }
    expect(shots.size).toBe(4); // each style looks different
  });

  it("gives the same bytes for the same input, so preview and export match", async () => {
    const t = template(box());
    const a = await renderImage(t, { ten: NAME });
    const b = await renderImage(t, { ten: NAME });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it("writes PNG and JPEG", async () => {
    const t = template(box());
    const png = (await renderImage(t, { ten: "A" }, { type: "png" })).data;
    const jpeg = (await renderImage(t, { ten: "A" }, { type: "jpeg", quality: 85 })).data;
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect([...jpeg.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it("draws nothing for an empty or missing value", async () => {
    expect(await blank((await renderImage(template(box()), { ten: "" })).data)).toBe(true);
    expect(await blank((await renderImage(template(box()), {})).data)).toBe(true);
  });

  it("matches a tag key written decomposed", async () => {
    const t = template(box({ field: "tên" }));
    const { data } = await renderImage(t, { [`${"tên".normalize("NFD")}`]: "Tên" });
    expect(await blank(data)).toBe(false);
  });

  it("refuses a font that is not installed and does not substitute", async () => {
    const t = template(box({ fontFamily: "Gone Font" }));
    await expect(renderImage(t, { ten: "A" })).rejects.toMatchObject({
      code: "font-missing",
      field: "Gone Font",
    });
  });

  it("refuses a background that is not an image", async () => {
    await expect(
      renderImage({ background: new Uint8Array([1, 2, 3]), boxes: [] }, {}),
    ).rejects.toBeInstanceOf(RenderError);
  });
});

describe("overflow", () => {
  const long = "Nguyễn Thị Hương Giang Phạm Đặng Ngọc Ánh Trần Văn Đức Bảo Anh Khoa";

  it("error: reports the row when the text does not fit one line", async () => {
    const t = template(box({ overflow: "error", width: 300 }));
    await expect(renderImage(t, { ten: long })).rejects.toMatchObject({ code: "text-too-long" });
    await expect(renderImage(t, { ten: "An" })).resolves.toBeDefined();
  });

  it("truncate: one line ending in an ellipsis within the box", async () => {
    const { data } = await renderImage(template(box({ overflow: "truncate", width: 300 })), {
      ten: long,
    });
    const px = await pixels(data);
    // Nothing is drawn to the right of the box (x from 340 on) in the rows of the text.
    const bg = await pixels(background());
    let outside = 0;
    for (let y = 40; y < 100; y++) {
      for (let x = 345; x < px.width; x++) {
        const i = (y * px.width + x) * 4;
        if (Math.abs((px.data[i] as number) - (bg.data[i] as number)) > 16) outside++;
      }
    }
    expect(outside).toBe(0);
  });

  it("wrap: uses several lines up to maxLines", async () => {
    const t = template(box({ overflow: "wrap", width: 300, maxLines: 3, fontSize: 32 }));
    const { data } = await renderImage(t, { ten: long });
    const px = await pixels(data);
    const bg = await pixels(background());
    const rowsWithInk: number[] = [];
    for (let y = 0; y < px.height; y++) {
      let ink = false;
      for (let x = 0; x < px.width && !ink; x++) {
        const i = (y * px.width + x) * 4;
        ink = Math.abs((px.data[i] as number) - (bg.data[i] as number)) > 40;
      }
      if (ink) rowsWithInk.push(y);
    }
    const lowest = rowsWithInk.at(-1) as number;
    expect(lowest).toBeGreaterThan(40 + 32 * 1.25 * 2); // reaches the third line
    expect(lowest).toBeLessThan(40 + 32 * 1.25 * 4); // but not a fourth
  });

  it("shrink: reduces the size so a long value fits one line", async () => {
    const wide = template(box({ overflow: "shrink", width: 360, fontSize: 48 }));
    const { data } = await renderImage(wide, { ten: NAME });
    expect(await blank(data)).toBe(false);
    const px = await pixels(data);
    const bg = await pixels(background());
    let beyond = 0;
    for (let y = 40; y < 120; y++) {
      for (let x = 405; x < px.width; x++) {
        const i = (y * px.width + x) * 4;
        if (Math.abs((px.data[i] as number) - (bg.data[i] as number)) > 16) beyond++;
      }
    }
    expect(beyond).toBe(0);
  });
});

describe("golden images (Linux reference)", () => {
  const cases: Array<[string, ImageTemplate, Record<string, string>]> = [
    [
      "four-styles",
      template(
        box({ y: 20, style: "normal", fontSize: 32 }),
        box({ y: 80, style: "bold", fontSize: 32 }),
        box({ y: 140, style: "italic", fontSize: 32 }),
        box({ y: 200, style: "bolditalic", fontSize: 32 }),
      ),
      { ten: NAME },
    ],
    [
      "centered-wrap",
      template(
        box({ align: "center", overflow: "wrap", maxLines: 2, width: 400, x: 200, fontSize: 36 }),
      ),
      { ten: NAME },
    ],
    [
      "shrink-right",
      template(
        box({
          align: "right",
          overflow: "shrink",
          width: 360,
          x: 400,
          fontSize: 48,
          color: "#b00020",
        }),
      ),
      { ten: NAME },
    ],
  ];

  for (const [name, t, values] of cases) {
    it.skipIf(process.platform !== "linux")(
      `${name} stays within 0.5% of the golden image`,
      async () => {
        const { data } = await renderImage(t, values);
        const file = join(GOLDEN, `${name}.png`);
        if (process.env.UPDATE_GOLDEN || !existsSync(file)) writeFileSync(file, data);
        expect(await difference(data, readFileSync(file))).toBeLessThan(0.005);
      },
    );
  }
});

describe("test environment", () => {
  it("has only the test fonts loaded", () => {
    expect(hasFamily(FAMILY)).toBe(true);
    expect(hasFamily("DejaVu Sans")).toBe(false);
  });
});
