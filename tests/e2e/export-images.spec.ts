import { mkdirSync, rmSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { openStorage } from "../../src/main/storage";
import {
  answerDialog,
  launch,
  recordReveals,
  revealed,
  shoot,
  toStepExport,
  workFolder,
  writeCsv1258,
} from "./export-support";
import { fileOf } from "./file-of";

const BACKGROUND = join(import.meta.dirname, "../fixtures/image/golden/four-styles.png");

const box = (fontFamily = "Sheetstamp Test") => ({
  id: "a",
  field: "ho_ten",
  x: 10,
  y: 10,
  width: 300,
  fontSize: 24,
  fontFamily,
  style: "normal" as const,
  color: "#c00000",
  align: "left" as const,
  maxLines: 1,
  overflow: "error" as const,
});

// Row 4 does not fit its 300 px box (overflow "error"): that row alone fails, with the code only.
const PEOPLE = [["Nguyễn Văn An"], ["Trần Thị Bình"], ["Lê Minh Châu"], ["W".repeat(40)]];
const HEADER = ["Họ tên"];

let work: string;
let dataDir: string;
let csv: string;
let out: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  work = workFolder("export-images");
  dataDir = join(work, "data");
  out = join(work, "out");
  mkdirSync(out, { recursive: true });
  csv = join(work, "nhan-vien.csv");
  writeCsv1258(csv, [HEADER, ...PEOPLE]);
  const storage = await openStorage(dataDir);
  const image = (name: string, fontFamily?: string) =>
    storage.createTemplate({
      name,
      kind: "image",
      imageLayout: { version: 1, boxes: [box(fontFamily)] },
      tags: [{ name: "ho_ten", label: "Họ tên" }],
      source: fileOf(BACKGROUND),
    });
  await image("Giấy khen");
  await image("Giấy font lạ", "Font Không Có");
});

test.afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const stray = async (folder: string) =>
  (await readdir(folder)).filter((name) => name.endsWith(".tmp") || name.startsWith(".sheetstamp"));

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPG = [0xff, 0xd8, 0xff];

test("image template: PNG by default, JPG when chosen and remembered; ZIP names, error report with the code only", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await recordReveals(app);
  await toStepExport(app, page, csv, "Giấy khen");
  await answerDialog(app, out);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(out);

  // The background is a PNG, so PNG is preselected and the example shows the extension.
  const png = page.getByRole("radio", { name: "PNG" });
  const jpg = page.getByRole("radio", { name: "JPG" });
  await expect(png).toBeChecked();
  await expect(page.getByTestId("file-example")).toHaveText("Nguyễn Văn An.png");
  await expect(page.getByText(/PNG tạo chậm hơn và file nặng hơn JPG/)).toBeVisible();
  // The size is an estimate and says so.
  await expect(page.getByTestId("size-estimate")).toContainText(/^Ước tính khoảng [\d,.]+ MB/);
  await shoot(page, "export-images", "options");

  // JPG changes the example and the estimate, and is remembered in the choices.
  await jpg.check();
  await expect(page.getByTestId("file-example")).toHaveText("Nguyễn Văn An.jpg");
  await expect(page.getByTestId("size-estimate")).toContainText(/^Ước tính khoảng [\d,.]+ MB/);
  await expect
    .poll(async () => (await (await openStorage(dataDir)).getChoices()).imageFormat)
    .toBe("jpg");
  await png.check();
  await expect(page.getByTestId("file-example")).toHaveText("Nguyễn Văn An.png");

  await page.getByRole("button", { name: "Xuất 4 file" }).click();
  await expect(page.getByTestId("export-done")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("done-title")).toHaveText("Đã tạo 3 file");
  await expect(page.getByTestId("failed-rows")).toContainText("1 dòng bị lỗi");
  const zipPath = (await page.getByTestId("zip-path").textContent()) ?? "";
  expect(zipPath).toMatch(/Sheetstamp_\d{4}-\d{2}-\d{2}_\d{6}\.zip$/);
  await shoot(page, "export-images", "done");

  expect((await readdir(out)).sort()).toEqual(
    [basename(zipPath), `${basename(zipPath).replace(/\.zip$/, "")}-errors.csv`].sort(),
  );
  expect(await stray(out)).toEqual([]);

  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const names = Object.keys(zip.files).map((n) => n.normalize("NFC"));
  expect(names).toEqual(["Nguyễn Văn An.png", "Trần Thị Bình.png", "Lê Minh Châu.png"]);
  for (const name of Object.keys(zip.files)) {
    const bytes = await zip.file(name)?.async("uint8array");
    expect([...(bytes ?? []).slice(0, 4)]).toEqual(PNG);
  }

  // Row 4 only, by number and code; no source data.
  const reportPath = zipPath.replace(/\.zip$/, "-errors.csv");
  const report = await readFile(reportPath, "utf8");
  expect(report).toBe("row,error_code\r\n4,text-too-long\r\n");
  expect(report).not.toContain("W");
  await page.getByRole("button", { name: "Xem báo cáo lỗi" }).click();
  await expect.poll(() => revealed(app)).toEqual([reportPath]);
  await app.close();
});

test("the remembered JPG comes back, and the ZIP holds JPEG files named with .jpg", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv, "Giấy khen");
  // The last export used PNG, the last choice made was PNG: remembered.
  await expect(page.getByRole("radio", { name: "PNG" })).toBeChecked();
  await page.getByRole("radio", { name: "JPG" }).check();
  await app.close();

  const again = await launch(dataDir);
  const second = await again.firstWindow();
  const folder = join(work, "out-jpg");
  mkdirSync(folder, { recursive: true });
  await toStepExport(again, second, csv, "Giấy khen");
  await expect(second.getByRole("radio", { name: "JPG" })).toBeChecked();
  await expect(second.getByTestId("file-example")).toHaveText("Nguyễn Văn An.jpg");
  await answerDialog(again, folder);
  await second.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(second.getByTestId("export-folder")).toHaveText(folder);
  await second.getByRole("button", { name: "Xuất 4 file" }).click();
  await expect(second.getByTestId("done-title")).toHaveText("Đã tạo 3 file", { timeout: 60_000 });
  const zipPath = (await second.getByTestId("zip-path").textContent()) ?? "";
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  expect(Object.keys(zip.files).map((n) => n.normalize("NFC"))).toEqual([
    "Nguyễn Văn An.jpg",
    "Trần Thị Bình.jpg",
    "Lê Minh Châu.jpg",
  ]);
  for (const name of Object.keys(zip.files)) {
    const bytes = await zip.file(name)?.async("uint8array");
    expect([...(bytes ?? []).slice(0, 3)]).toEqual(JPG);
  }
  await again.close();
});

test("a missing font blocks the export up front with one message and the fix", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv, "Giấy font lạ");
  await expect(page.getByTestId("export-blocker")).toContainText(
    "Font “Font Không Có” không còn trên máy này",
  );
  await expect(page.getByTestId("export-blocker")).toContainText("chọn font khác");
  await expect(page.getByRole("button", { name: "Xuất 4 file" })).toBeDisabled();
  await expect(page.getByTestId("size-estimate")).toHaveCount(0);
  await app.close();
});

test("cancelling an image export in the middle leaves no ZIP, no report and no temporary file", async () => {
  const big = join(work, "lon.csv");
  writeCsv1258(big, [HEADER, ...Array.from({ length: 4000 }, (_, i) => [`Người số ${i + 1}`])]);
  const cancelOut = join(work, "out-cancel");
  mkdirSync(cancelOut, { recursive: true });

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, big, "Giấy khen");
  await page.getByRole("radio", { name: "PNG" }).check(); // PNG is the slow format: plenty of time to cancel
  await answerDialog(app, cancelOut);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(cancelOut);

  await page.getByRole("button", { name: "Xuất 4000 file" }).click();
  await expect(page.getByTestId("export-progress-text")).toHaveText(
    /^Đang tạo file… [1-9]\d*\/4000$/,
  );
  expect((await stray(cancelOut)).length).toBe(1);
  await page.getByRole("button", { name: "Hủy" }).click();

  const notice = page.getByRole("alert").filter({ hasText: /Chưa lưu gì cả/ });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  expect(await readdir(cancelOut)).toEqual([]);
  await app.close();
  expect(await readdir(cancelOut)).toEqual([]);
});
