import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { _electron as electron, expect, test } from "@playwright/test";
import { openStorage } from "../../src/main/storage";

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
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xc8)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const box = (id: string, field: string, x: number, y: number) => ({
  id,
  field,
  x,
  y,
  width: 100,
  fontSize: 20,
  fontFamily: "sans-serif",
  style: "normal",
  color: "#1a1a1a",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
});

test("edit an image template, then replace the background with a smaller image", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-image-edit-"));
  const dataDir = join(work, "data");
  const small = join(work, "nho.png");
  writeFileSync(small, makePng(300, 200));

  const storage = await openStorage(dataDir);
  await storage.createTemplate({
    name: "Thư mời",
    kind: "image",
    note: "",
    source: { bytes: makePng(400, 300), fileName: "nen.png" },
    imageLayout: {
      version: 1,
      boxes: [box("a", "ho_ten", 10, 10), box("b", "ngay", 250, 10), box("c", "dia_chi", 10, 250)],
    },
    tags: [
      { name: "ho_ten", label: "Họ và tên" },
      { name: "ngay", label: "Ngày" },
      { name: "dia_chi", label: "Địa chỉ" },
    ],
    filenamePattern: "{{ho_ten}}",
  });
  const sources = join(dataDir, "sources");
  const initialCopy = readdirSync(sources);

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  const row = page.getByTestId("template-row");

  // Name, note and pattern.
  await row.getByRole("button", { name: /^Sửa thông tin/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Tên mẫu")).toHaveValue("Thư mời");
  await dialog.getByLabel("Tên mẫu").fill("Thư mời 2026");
  await dialog.getByLabel("Ghi chú").fill("Bản in A5");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("Thư mời 2026");
  await expect(row).toContainText("Bản in A5");

  // The boxes reopen in the editor.
  await row.getByRole("button", { name: /^Sửa ảnh/ }).click();
  await expect(page.getByTestId("box-item")).toHaveCount(3);
  await expect(page.getByTestId("outside-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "‹ Mẫu" }).click();

  // Replace with a 300 x 200 image: b is cut, c is outside; the list comes before anything is saved.
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, small);
  await row.getByRole("button", { name: /^Sửa thông tin/ }).click();
  await dialog.getByRole("button", { name: "Thay ảnh nền…" }).click();
  await expect(dialog.getByTestId("edit-file-name")).toHaveText("nho.png");
  await expect(dialog.getByTestId("image-size")).toContainText("300 × 200");
  await expect(dialog.getByTestId("outside-box")).toHaveText([
    /Ngày: một phần nằm ngoài/,
    /Địa chỉ: nằm hoàn toàn ngoài/,
  ]);
  expect(readdirSync(sources)).toEqual(initialCopy);

  // Saving asks once more; going back stores nothing.
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(dialog.getByText("Thay ảnh dù 2 ô chữ nằm ngoài ảnh mới?")).toBeVisible();
  await dialog.getByRole("button", { name: "Quay lại" }).click();
  expect(readdirSync(sources)).toEqual(initialCopy);
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await dialog.getByRole("button", { name: "Vẫn thay ảnh" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("nho.png");
  expect(readdirSync(sources)).toHaveLength(1);
  expect(readdirSync(sources)).not.toEqual(initialCopy);

  // Boxes keep their place; the two that do not fit are flagged.
  await row.getByRole("button", { name: /^Sửa ảnh/ }).click();
  await expect(page.getByTestId("box-item")).toHaveCount(3);
  await expect(page.getByTestId("box-position")).toHaveText([
    "x 10, y 10, rộng 100",
    "x 250, y 10, rộng 100",
    "x 10, y 250, rộng 100",
  ]);
  await expect(page.getByTestId("box-outside")).toHaveCount(2);
  await expect(page.getByTestId("outside-banner")).toBeVisible();
  await app.close();
});

test("a bad replacement image shows the reason and the old image stays", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-image-edit-"));
  const dataDir = join(work, "data");
  const gif = join(work, "anh.png");
  writeFileSync(gif, Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"));
  const storage = await openStorage(dataDir);
  await storage.createTemplate({
    name: "Thư mời",
    kind: "image",
    source: { bytes: makePng(40, 30), fileName: "nen.png" },
    imageLayout: { version: 1, boxes: [] },
  });

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, gif);
  await page.getByRole("button", { name: /^Sửa thông tin/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Thay ảnh nền…" }).click();
  await expect(dialog.getByTestId("replace-error")).toContainText("Chỉ nhận ảnh PNG hoặc JPG");
  await expect(dialog.getByTestId("edit-file-name")).toHaveText("nen.png");
  await app.close();
});
