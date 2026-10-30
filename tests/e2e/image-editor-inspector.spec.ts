import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";

const root = join(import.meta.dirname, "../..");
const backgroundPath = join(root, "tests/fixtures/image/golden/four-styles.png");

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

test("inspector: pick the test font, size, colour, style and alignment, and neither Advanced nor Preview is shown", async () => {
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

  // The test family has all four styles, so bold and italic are both available as toggles.
  const bold = page.getByRole("button", { name: "Đậm", exact: true });
  const italic = page.getByRole("button", { name: "Nghiêng", exact: true });
  await expect(bold).toBeEnabled();
  await expect(italic).toBeEnabled();
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await italic.click();
  await expect(italic).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await expect(italic).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("radio", { name: "Giữa" }).check({ force: true });
  await expect(page.getByRole("radio", { name: "Giữa" })).toBeChecked();

  // Advanced and Preview are gone from the editor.
  await expect(page.getByText("Nâng cao", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xem trước", exact: true })).toHaveCount(0);

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
