import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { _electron as electron, expect, test } from "@playwright/test";

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** A valid solid-colour RGB PNG. */
function makePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xc8)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function stubOpenDialog(app: Awaited<ReturnType<typeof launch>>, path: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, path);
}

const IMAGE = { width: 400, height: 300 };

test("create an image template, add two boxes, drag one, delete the other, save and reopen", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const dataDir = join(work, "data");
  const png = join(work, "nen.png");
  writeFileSync(png, makePng(IMAGE.width, IMAGE.height));

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  page.on("pageerror", (e) => violations.push(e.message));

  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  await stubOpenDialog(app, png);
  await page.getByRole("button", { name: "Tạo mẫu đầu tiên" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
  await dialog.getByLabel("Tên mẫu").fill("Giấy khen");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();

  // Lands in the editor.
  await expect(page.getByRole("button", { name: "‹ Mẫu" })).toBeVisible();
  const canvas = page.getByTestId("editor-canvas").locator("canvas").first();
  await expect(canvas).toBeVisible();
  // The real background is painted (the solid PNG colour 0xc8), whatever the theme.
  const pixel = await canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    return Array.from(ctx.getImageData(2, 2, 1, 1).data);
  });
  expect(pixel).toEqual([200, 200, 200, 255]);

  await page.getByRole("button", { name: "+ Thêm chữ" }).click();
  await page.getByRole("button", { name: "+ Thêm chữ" }).click();
  const items = page.getByTestId("box-item");
  await expect(items).toHaveCount(2);
  await expect(page.getByTestId("editor-live")).toContainText("Đã chọn ô chữ Trường 2");

  // Drag the first box: its position is read from the list, the canvas scale from the canvas size.
  const readXY = async (i: number) => {
    const text = (await items.nth(i).getByTestId("box-position").textContent()) ?? "";
    const m = /x (-?\d+), y (-?\d+)/.exec(text);
    return { x: Number(m?.[1]), y: Number(m?.[2]) };
  };
  const before = await readXY(0);
  const rect = (await canvas.boundingBox()) as { x: number; y: number; width: number };
  const scale = rect.width / IMAGE.width;
  const grabX = rect.x + (before.x + 30) * scale;
  const grabY = rect.y + (before.y + 8) * scale;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 40 * scale, grabY + 60 * scale, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await readXY(0)).x).toBeGreaterThan(before.x + 30);
  const moved = await readXY(0);
  expect(moved.y).toBeGreaterThan(before.y + 50);

  // Resize in width with the handle on the right edge of the selected box; stored in image pixels.
  const widthOf = async () =>
    Number(
      /rộng (\d+)/.exec((await items.nth(0).getByTestId("box-position").textContent()) ?? "")?.[1],
    );
  await items.nth(0).click();
  const w0 = await widthOf();
  const handleX = rect.x + (moved.x + w0) * scale;
  const handleY = rect.y + (moved.y + 7) * scale;
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX - 50 * scale, handleY, { steps: 8 });
  await page.mouse.up();
  await expect.poll(widthOf).toBeLessThan(w0 - 40);
  expect(await readXY(0)).toEqual(moved);

  // A window resize changes the view scale only, never the stored position.
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setSize(900, 700);
  });
  await expect.poll(async () => (await canvas.boundingBox())?.width).not.toBe(rect.width);
  expect(await readXY(0)).toEqual(moved);

  // Delete the second box with the keyboard, the first stays.
  await items.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("editor-live")).toContainText("Đã xóa ô chữ");

  // Name the field of the box as free text: no list, no suggestions. The field has a number.
  await items.first().click();
  const field = page.getByLabel("Trường số 1", { exact: true });
  await expect(field).toHaveValue("Trường 1");
  await expect(page.getByText("Cột thứ 1 của file dữ liệu sẽ điền vào trường này.")).toBeVisible();
  await field.fill("ngay");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await field.fill("?!");
  await expect(page.getByText("Nhập tên trường có chữ hoặc số.")).toBeVisible();
  await field.fill("Số quyết định");
  await page.keyboard.press("Enter");
  await expect(items.first()).toContainText("Số quyết định");

  await page.getByRole("button", { name: "Lưu mẫu" }).click();
  // The page shows the message inline and as a toast: either one proves the save.
  await expect(page.getByText("Đã lưu mẫu.").first()).toBeVisible();
  await page.getByRole("button", { name: "‹ Mẫu" }).click();

  // The library counts distinct fields; reopening finds the box where it was saved.
  const row = page.getByTestId("template-row");
  await expect(row).toContainText("1 trường");
  await row.getByRole("button", { name: /^Sửa ảnh/ }).click();
  await expect(page.getByTestId("box-item")).toHaveCount(1);
  await expect(page.getByTestId("box-item")).toContainText("Số quyết định");
  expect(await readXY(0)).toEqual(moved);
  expect(violations).toEqual([]);
  await app.close();
});
