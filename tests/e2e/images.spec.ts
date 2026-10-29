import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";

const root = join(import.meta.dirname, "../..");
const background = readFileSync(join(root, "tests/fixtures/image/golden/four-styles.png"));

// The e2e build (npm run build:e2e) loads only tests/fixtures/fonts, so the list does not depend on the runner.
const launch = () =>
  electron.launch({ args: [root, ...(process.platform === "linux" ? ["--no-sandbox"] : [])] });

const box = {
  field: "ho_ten",
  x: 40,
  y: 40,
  width: 700,
  fontSize: 48,
  fontFamily: "Sheetstamp Test",
  style: "bold",
  color: "#1a1a1a",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
};

type Reply = { ok?: boolean; code?: string; field?: string; head?: number[]; rejected?: string };

/** Call image:render from the window; a rejected call is reported by message, and a PNG by its first 32 bytes. */
const render = (page: Page, boxes: unknown[], values: unknown): Promise<Reply> =>
  page.evaluate(
    async ({ b64, boxes, values }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      try {
        const reply = (await window.sheetstamp.invoke("image:render", {
          background: bytes,
          boxes,
          values,
        })) as { ok: boolean; png?: Uint8Array; code?: string; field?: string };
        const { png, ...rest } = reply;
        return png ? { ...rest, head: Array.from(png.slice(0, 32)) } : rest;
      } catch (error) {
        return { rejected: (error as Error).message };
      }
    },
    { b64: background.toString("base64"), boxes, values },
  );

test("lists the test family with its real styles and renders one row to a PNG as big as the background", async () => {
  const app = await launch();
  const page = await app.firstWindow();

  const fonts = await page.evaluate(() => window.sheetstamp.invoke("fonts:list"));
  expect(fonts).toEqual([
    { family: "Sheetstamp Test", styles: ["normal", "bold", "italic", "bolditalic"] },
  ]);

  const reply = await render(page, [box], { ho_ten: "Nguyễn Thị Hương Đặng Ngọc Ánh" });
  expect(reply.ok, JSON.stringify(reply)).toBe(true);
  const header = Buffer.from(reply.head ?? []);
  expect(header.subarray(1, 4).toString("latin1")).toBe("PNG");
  // IHDR: width and height are 4 bytes each, big endian, right after the 8-byte signature and the chunk header.
  const want = { width: background.readUInt32BE(16), height: background.readUInt32BE(20) };
  expect({ width: header.readUInt32BE(16), height: header.readUInt32BE(20) }).toEqual(want);

  await app.close();
});

test("a font that is not installed comes back as a code with the field, and bad arguments are refused", async () => {
  const app = await launch();
  const page = await app.firstWindow();

  expect(await render(page, [{ ...box, fontFamily: "Not Installed" }], { ho_ten: "A" })).toEqual({
    ok: false,
    code: "font-missing",
    field: "Not Installed",
  });
  expect(await render(page, [{ ...box, style: "heavy" }], {})).toEqual({
    rejected: expect.stringContaining("style must be one of"),
  });
  const refused = await page.evaluate(() =>
    window.sheetstamp.invoke("fonts:list", { x: 1 }).then(
      () => "ok",
      (e: Error) => e.message,
    ),
  );
  expect(refused).toContain("takes no argument");

  await app.close();
});
