import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";
import { makeDocx, paragraph, run } from "../../src/main/selftest/make-docx";

const SHOTS = join(import.meta.dirname, "../../test-results/templates");

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

/** Template with a tag split over runs, a repeated tag, a loop and a tag only in a footnote. */
async function fixture(dir: string, fileName: string): Promise<string> {
  const docx = await makeDocx({
    body: [
      paragraph(run("Họ tên: {{ho_"), run("ten}}")),
      paragraph(run("Ngày sinh: {{ngay_sinh}} và {{ho_ten}}")),
      paragraph(run("{{#con}}")),
      paragraph(run("Con: {{ten_con}}")),
      paragraph(run("{{/con}}")),
    ].join(""),
    extra: {
      "word/footnotes.xml": `<?xml version="1.0" encoding="UTF-8"?><w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>Ghi chú {{chi_nhanh}}</w:t></w:r></w:p></w:footnote></w:footnotes>`,
    },
  });
  const path = join(dir, fileName);
  writeFileSync(path, docx);
  return path;
}

async function stubOpenDialog(app: Awaited<ReturnType<typeof launch>>, path: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, path);
}

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400); // let colour transitions finish
    await page.screenshot({ path: join(SHOTS, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

test("create, keep across restart, and delete a Word template", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const dataDir = join(work, "data");
  const file = await fixture(work, "hop-dong-lao-dong.docx");

  let app = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();

  // Empty state.
  await expect(page.getByText("Chưa có mẫu tài liệu nào.")).toBeVisible();
  await shoot(page, "empty");

  // New template dialog.
  await stubOpenDialog(app, file);
  await page.getByRole("button", { name: "Tạo mẫu đầu tiên" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Thả file Word (.docx) vào đây")).toBeVisible();
  await dialog.getByRole("button", { name: "Chọn file…" }).click();
  await expect(dialog.getByTestId("chosen-file")).toHaveText("hop-dong-lao-dong.docx");
  await expect(dialog.getByLabel("Tên mẫu")).toHaveValue("hop-dong-lao-dong");

  // 3 fields (ho_ten once, ngay_sinh, ten_con); loop open and close and the footnote tag are unsupported.
  await expect(dialog.getByTestId("field-count")).toHaveText("Tìm thấy 3 trường trong file.");
  const unsupported = dialog.getByTestId("unsupported-list").getByRole("listitem");
  await expect(unsupported).toHaveCount(3);
  await expect(dialog.getByTestId("unsupported-list")).toContainText("{{#con}}");
  await expect(dialog.getByTestId("unsupported-list")).toContainText("{{chi_nhanh}}");

  // Labels: suggested from the dictionary, else readable; one is edited.
  await dialog.getByText("Xem tên hiển thị").click();
  await expect(dialog.getByLabel("Tên hiển thị của ho_ten")).toHaveValue("Họ và tên");
  await expect(dialog.getByLabel("Tên hiển thị của ten_con")).toHaveValue("Ten con");
  await dialog.getByLabel("Tên hiển thị của ten_con").fill("Tên con");

  await dialog.getByLabel("Tên mẫu").fill("Hợp đồng lao động");
  await dialog.getByRole("button", { name: "+ Thêm ghi chú" }).click();
  await dialog.getByLabel("Ghi chú").fill("Bản 2026");

  // A new group on the spot.
  await dialog.getByLabel("Nhóm").selectOption({ label: "+ Thêm nhóm mới…" });
  await dialog.getByLabel("Tên nhóm mới").fill("Tuyển dụng");
  await shoot(page, "dialog");

  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByText("Đã lưu mẫu.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("template-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Hợp đồng lao động");
  await expect(row).toContainText("3 trường, chưa dùng. Bản 2026");
  await expect(row).toContainText("Tuyển dụng");
  await expect(row.getByRole("button", { name: "Sửa" })).toBeEnabled();
  await shoot(page, "list");

  // The stored copy exists in the data folder.
  expect(readdirSync(join(dataDir, "sources"))).toHaveLength(1);

  // Duplicate name in the same group warns without blocking.
  await page.getByRole("button", { name: "+ Mẫu mới" }).click();
  await stubOpenDialog(app, file);
  await dialog.getByRole("button", { name: "Chọn file…" }).click();
  await dialog.getByLabel("Nhóm").selectOption({ label: "Tuyển dụng" });
  await dialog.getByLabel("Tên mẫu").fill("Hợp đồng lao động");
  await expect(dialog.getByText(/Đã có mẫu cùng tên trong nhóm này/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Lưu mẫu" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(1);

  // Restart with the same data folder: the row, group and labels are still there.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await expect(page.getByTestId("template-row")).toHaveCount(1);
  await expect(page.getByTestId("template-row")).toContainText("3 trường");
  const detail = await page.evaluate(async () => {
    const all = (await window.sheetstamp.invoke("templates:list")) as { id: string }[];
    return window.sheetstamp.invoke("templates:get", { id: all[0]?.id });
  });
  expect(detail).toMatchObject({
    name: "Hợp đồng lao động",
    tags: expect.arrayContaining([
      { name: "ten_con", label: "Tên con" },
      { name: "ho_ten", label: "Họ và tên" },
    ]),
  });

  // Inline deletion: keep first, then delete.
  const again = page.getByTestId("template-row");
  await again.getByRole("button", { name: /^Xóa/ }).click();
  await expect(again.getByText("Xóa mẫu này?")).toBeVisible();
  await shoot(page, "confirm");
  await again.getByRole("button", { name: "Giữ lại" }).click();
  await expect(again).toHaveCount(1);
  await again.getByRole("button", { name: /^Xóa/ }).click();
  await again.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(page.getByText("Chưa có mẫu tài liệu nào.")).toBeVisible();
  expect(existsSync(join(dataDir, "sources")) ? readdirSync(join(dataDir, "sources")) : []).toEqual(
    [],
  );

  await app.close();
});

test("a wrong or oversized file is refused with a message", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-"));
  const txt = join(work, "ghi-chu.txt");
  writeFileSync(txt, "hello");
  const big = join(work, "lon.docx");
  writeFileSync(big, Buffer.alloc(21 * 1024 * 1024));
  const broken = join(work, "hong.docx");
  writeFileSync(broken, "not a zip");

  const app = await launch(join(work, "data"));
  const page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();
  await page.getByRole("button", { name: "+ Mẫu mới" }).click();
  const dialog = page.getByRole("dialog");

  for (const [path, message] of [
    [txt, /Chỉ nhận file Word/],
    [big, /lớn hơn 20 MB/],
    [broken, /không phải tài liệu Word/],
  ] as const) {
    await stubOpenDialog(app, path);
    await dialog.getByRole("button", { name: "Chọn file…" }).click();
    await expect(dialog.getByText(message)).toBeVisible();
  }
  await app.close();
});
