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

const openImagesTab = async (
  page: Awaited<ReturnType<typeof launch>>["firstWindow"] extends () => Promise<infer P>
    ? P
    : never,
) => {
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
};

test("create and delete an image template from a generated PNG", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const dataDir = join(work, "data");
  const png = join(work, "thu-moi.png");
  writeFileSync(png, makePng(64, 48));

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await openImagesTab(page);

  await expect(page.getByText("Chưa có mẫu ảnh nào.")).toBeVisible();
  await stubOpenDialog(app, png);
  await page.getByRole("button", { name: "Tạo mẫu đầu tiên" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Thả ảnh nền (PNG, JPG) vào đây")).toBeVisible();
  await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
  await expect(dialog.getByTestId("chosen-file")).toHaveText("thu-moi.png");
  await expect(dialog.getByTestId("image-size")).toContainText("64 × 48");
  await expect(dialog.getByLabel("Tên mẫu")).toHaveValue("thu-moi");
  await dialog.getByLabel("Tên mẫu").fill("Thư mời");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();

  // A new image template opens in the editor; "‹ Mẫu" returns to the list.
  await page.getByRole("button", { name: "‹ Mẫu" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByTestId("template-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Thư mời");
  await expect(row).toContainText("thu-moi.png, 0 trường, chưa dùng");
  await expect(row.getByRole("button", { name: /^Sửa ảnh/ })).toHaveCount(1);

  // The Tài liệu tab has none of it.
  await page.getByRole("button", { name: "Tài liệu", exact: true }).click();
  await expect(page.getByText("Chưa có mẫu tài liệu nào.")).toBeVisible();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();

  // The stored copy stays when the original is gone (it lives in the data folder).
  expect(readdirSync(join(dataDir, "sources"))).toHaveLength(1);

  await row.getByRole("button", { name: /^Xóa/ }).click();
  await expect(row.getByText("Xóa mẫu này?")).toBeVisible();
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(page.getByText("Chưa có mẫu ảnh nào.")).toBeVisible();
  expect(existsSync(join(dataDir, "sources")) ? readdirSync(join(dataDir, "sources")) : []).toEqual(
    [],
  );
  await app.close();
});

test("a renamed gif, a cut-off JPEG and an unreadable file are refused with a fix", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const gif = join(work, "anh.png");
  writeFileSync(gif, Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"));
  const cut = join(work, "cat.jpg");
  writeFileSync(cut, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]));
  const missing = join(work, "khong-co.png");

  const app = await launch(join(work, "data"));
  const page = await app.firstWindow();
  await openImagesTab(page);
  await page.getByRole("button", { name: "+ Mẫu mới" }).click();
  const dialog = page.getByRole("dialog");

  for (const [path, message] of [
    [gif, /Chỉ nhận ảnh PNG hoặc JPG/],
    [cut, /Ảnh bị cắt dở/],
    [missing, /Không đọc được file này/],
  ] as const) {
    await stubOpenDialog(app, path);
    await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
    await expect(dialog.getByText(message)).toBeVisible();
  }
  await app.close();
});

test("an image above 4 megapixels shows a warning and one above 25 is refused", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const large = join(work, "lon.png");
  writeFileSync(large, makePng(2100, 2000));
  const huge = join(work, "rat-lon.png");
  writeFileSync(huge, makePng(5100, 5000));

  const app = await launch(join(work, "data"));
  const page = await app.firstWindow();
  await openImagesTab(page);
  await page.getByRole("button", { name: "+ Mẫu mới" }).click();
  const dialog = page.getByRole("dialog");

  await stubOpenDialog(app, large);
  await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
  await expect(dialog.getByText("Ảnh lớn, mỗi file có thể mất vài giây.")).toBeVisible();
  await stubOpenDialog(app, huge);
  await dialog.getByRole("button", { name: "Chọn ảnh khác" }).click();
  await expect(dialog.getByText(/lớn hơn 25 megapixel/)).toBeVisible();
  await app.close();
});

test("a duplicate name in the same group warns under the name field", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const png = join(work, "nen.png");
  writeFileSync(png, makePng(16, 16));

  const app = await launch(join(work, "data"));
  const page = await app.firstWindow();
  await openImagesTab(page);
  await stubOpenDialog(app, png);
  for (const round of [1, 2]) {
    await page.getByRole("button", { name: "+ Mẫu mới" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
    await dialog.getByLabel("Tên mẫu").fill("Giấy khen");
    if (round === 1) {
      await expect(dialog.getByText(/Đã có mẫu cùng tên/)).toBeHidden();
      await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
      await page.getByRole("button", { name: "‹ Mẫu" }).click();
    } else {
      await expect(dialog.getByText(/Đã có mẫu cùng tên trong nhóm này/)).toBeVisible();
    }
  }
  await app.close();
});
