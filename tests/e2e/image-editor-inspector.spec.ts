import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";

const root = join(import.meta.dirname, "../..");
const backgroundPath = join(root, "tests/fixtures/image/golden/four-styles.png");
const background = readFileSync(backgroundPath);
const size = { width: background.readUInt32BE(16), height: background.readUInt32BE(20) };

// The e2e build installs only the family "Sheetstamp Test" (4 styles), so these tests do not depend on the runner.
const launch = (dataDir: string) =>
  electron.launch({
    args: [root, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

async function createTemplate(app: Awaited<ReturnType<typeof launch>>, page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, backgroundPath);
  await page.getByRole("button", { name: "Tạo mẫu đầu tiên" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Chọn ảnh…" }).click();
  await dialog.getByLabel("Tên mẫu").fill("Giấy khen");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByRole("button", { name: "‹ Mẫu" })).toBeVisible();
}

test("inspector: pick the test font, size, colour, style and alignment, then preview with diacritics", async () => {
  const app = await launch(join(mkdtempSync(join(tmpdir(), "sheetstamp-e2e-")), "data"));
  const page = await app.firstWindow();
  await createTemplate(app, page);

  await expect(page.getByText("Chọn một khung chữ")).toBeVisible();
  await page.getByRole("button", { name: "+ Thêm chữ" }).click();

  await page.getByLabel("Font", { exact: true }).selectOption("Sheetstamp Test");
  await expect(page.getByText("Chỉ hiện font đã cài trên máy này.")).toBeVisible();
  await page.getByLabel("Cỡ chữ").fill("48");

  // An invalid hex keeps the last valid colour and says why.
  const hex = page.getByLabel("Mã màu (hex)");
  await hex.fill("#c00000");
  await hex.fill("#c0000");
  await expect(page.getByText(/Mã màu chưa đúng.*#c00000/)).toBeVisible();
  await hex.fill("#c00000");
  await expect(page.getByText(/Mã màu chưa đúng/)).toHaveCount(0);

  // The test family has all four styles, so none is disabled.
  for (const name of ["Thường", "Đậm", "Nghiêng", "Đậm nghiêng"])
    await expect(page.getByRole("radio", { name, exact: true })).toBeEnabled();
  await page.getByText("Đậm", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Đậm", exact: true })).toBeChecked();
  await page.getByText("Giữa", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Giữa" })).toBeChecked();

  // "Nâng cao" is collapsed until opened.
  await expect(page.getByLabel("Số dòng tối đa")).toBeHidden();
  await page.getByText("Nâng cao", { exact: true }).click();
  await expect(page.getByLabel("Khi chữ quá dài")).toBeVisible();

  // No data is loaded, so the sample is the field label (with diacritics); the preview is as big as the background.
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  const image = page.getByTestId("preview-image");
  await expect(image).toBeVisible();
  const drawn = await image.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4)
      if ((data[i] ?? 0) > 150 && (data[i + 1] ?? 255) < 60) red++;
    return { width: img.naturalWidth, height: img.naturalHeight, red };
  });
  expect({ width: drawn.width, height: drawn.height }).toEqual(size);
  expect(drawn.red).toBeGreaterThan(50);

  // A too-long text under "report an error" is the row-level message in the preview.
  await page.getByLabel("Khi chữ quá dài").selectOption({ label: "Báo lỗi cho dòng đó" });
  await page.getByLabel("Cỡ chữ").fill("400");
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  await expect(page.getByTestId("preview-error")).toContainText("quá dài");

  await app.close();
});

test("a saved font that is not installed shows one message, saving is refused until another family is picked", async () => {
  const app = await launch(join(mkdtempSync(join(tmpdir(), "sheetstamp-e2e-")), "data"));
  const page = await app.firstWindow();
  await createTemplate(app, page);

  // Save two boxes that both name a family that is not installed (as if it was removed later).
  const id = await page.evaluate(async () => {
    const list = (await window.sheetstamp.invoke("templates:list")) as {
      id: string;
      kind: string;
    }[];
    return list.find((t) => t.kind === "image")?.id;
  });
  expect(id).toBeTruthy();
  const box = (n: number) => ({
    id: `b${n}`,
    field: "ho_ten",
    x: 10 * n,
    y: 20,
    width: 300,
    fontSize: 40,
    fontFamily: "Gone Sans",
    style: "normal",
    color: "#1a1a1a",
    align: "left",
    maxLines: 1,
    overflow: "shrink",
  });
  await page.evaluate(
    ({ id, boxes }) =>
      window.sheetstamp.invoke("image-editor:save", {
        id,
        layout: { version: 1, boxes },
        labels: { ho_ten: "Họ và tên" },
      }),
    { id, boxes: [box(1), box(2)] },
  );
  await page.getByRole("button", { name: "‹ Mẫu" }).click();
  await page
    .getByTestId("template-row")
    .getByRole("button", { name: /^Sửa ảnh/ })
    .click();

  const message = page.getByTestId("missing-font");
  await expect(message).toHaveCount(1);
  await expect(message).toContainText("Gone Sans");
  expect(((await message.textContent()) ?? "").split("Gone Sans")).toHaveLength(2);

  await page.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByText(/Chưa lưu: còn khung chữ dùng font/)).toBeVisible();

  // Nothing was substituted: the select still names the missing family until the user picks another.
  const items = page.getByTestId("box-item");
  for (let i = 0; i < 2; i++) {
    await items.nth(i).click();
    await page.getByLabel("Font", { exact: true }).selectOption("Sheetstamp Test");
  }
  await expect(page.getByTestId("missing-font")).toHaveCount(0);
  await page.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByText("Đã lưu mẫu.").first()).toBeVisible();
  await app.close();
});
