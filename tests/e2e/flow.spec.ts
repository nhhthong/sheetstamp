import { mkdirSync, rmSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { textOf } from "../../src/main/selftest/make-docx";
import {
  answerDialog,
  HEADER,
  launch,
  PEOPLE,
  recordReveals,
  revealed,
  seedTemplate,
  shoot,
  step,
  toStepExport,
  workFolder,
  writeCsv1258,
  writeTemplate,
} from "./export-support";

let work: string;
let dataDir: string;
let out: string;
let csv: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  work = workFolder("flow");
  dataDir = join(work, "data");
  out = join(work, "out");
  mkdirSync(out, { recursive: true });
  csv = join(work, "nhan-vien.csv");
  writeCsv1258(csv, [HEADER, ...PEOPLE]);
  const docx = join(work, "mau.docx");
  await writeTemplate(docx);
  await seedTemplate(dataDir, docx);
});

test.afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const stray = async (folder: string) =>
  (await readdir(folder)).filter((name) => name.endsWith(".tmp") || name.startsWith(".sheetstamp"));

test("the whole flow: data, template, mapping, file name, folder, export, ZIP and error report", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await recordReveals(app);
  await toStepExport(app, page, csv);

  // Step 4 starts with the default pattern (first field, since the template has no field "ten") for the first row.
  await expect(page.getByTestId("file-example")).toHaveText("Nguyễn Văn An.docx");
  await expect(page.getByTestId("export-folder")).not.toHaveText("");
  await expect(page.getByRole("button", { name: "Xuất 12 file" })).toBeEnabled();

  // Edit the pattern with chips: department, name, fixed text.
  await page.getByRole("button", { name: "Đổi tên file" }).click();
  const editor = page.getByTestId("filename-editor");
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId("pattern-chip")).toHaveCount(1);
  await editor.getByRole("button", { name: "Bỏ Họ tên" }).click();
  await editor.getByRole("button", { name: "Thêm trường Phòng ban" }).click();
  await editor.getByLabel("Thêm chữ").fill("_");
  await editor.getByRole("button", { name: "Thêm", exact: true }).click();
  await editor.getByRole("button", { name: "Thêm trường Họ tên" }).click();
  await editor.getByLabel("Thêm chữ").fill("_Thử việc");
  await editor.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(editor.getByTestId("pattern-chip")).toHaveCount(4);
  await expect(editor.locator('[data-kind="field"]')).toHaveCount(2);
  await expect(editor.locator('[data-kind="text"]')).toHaveCount(2);
  await expect(page.getByTestId("file-example")).toHaveText("Kế toán_Nguyễn Văn An_Thử việc.docx");
  await shoot(page, "flow", "editor");
  await editor.getByRole("button", { name: "Xong" }).click();
  await expect(editor).toBeHidden();

  // The folder comes from the native picker, answered from the test.
  await answerDialog(app, out);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(out);

  await page.getByRole("button", { name: "Xuất 12 file" }).click();
  await expect(page.getByTestId("export-done")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("done-title")).toHaveText("Đã tạo 11 file");
  await expect(page.getByTestId("failed-rows")).toContainText("1 dòng bị lỗi");
  const zipPath = (await page.getByTestId("zip-path").textContent()) ?? "";
  expect(zipPath).toMatch(/Sheetstamp_\d{4}-\d{2}-\d{2}_\d{6}\.zip$/);
  await shoot(page, "flow", "done");

  // On disk: the ZIP, its error report, and nothing temporary.
  expect((await readdir(out)).sort()).toEqual(
    [basename(zipPath), `${basename(zipPath).replace(/\.zip$/, "")}-errors.csv`].sort(),
  );
  expect(await stray(out)).toEqual([]);

  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const names = Object.keys(zip.files).map((n) => n.normalize("NFC"));
  expect(names).toHaveLength(11);
  // UTF-8 names built from the pattern, in row order; row 5 (the bad row) is missing, the repeated person is numbered.
  expect(names).toEqual([
    "Kế toán_Nguyễn Văn An_Thử việc.docx",
    "Nhân sự_Trần Thị Bình_Thử việc.docx",
    "Kinh doanh_Lê Minh Châu_Thử việc.docx",
    "Kho vận_Phạm Quốc Đạt_Thử việc.docx",
    "Hành chính_Đặng Thùy Dương_Thử việc.docx",
    "Kho vận_Hoàng Gia Huy_Thử việc.docx",
    "Kế toán_Bùi Ngọc Ánh_Thử việc.docx",
    "Kinh doanh_Ngô Quang Vinh_Thử việc.docx",
    "Nhân sự_Đinh Tuấn Kiệt_Thử việc.docx",
    "Nhân sự_Trần Thị Bình_Thử việc (2).docx",
    "Kế toán_Lý Hoài Thương_Thử việc.docx",
  ]);

  // Content: body (split runs), table, header, footer; the fixed text typed in the mapping step.
  const first = await zip.file(Object.keys(zip.files)[0] as string)?.async("uint8array");
  const body = await textOf(first as Uint8Array, "word/document.xml");
  expect(body).toContain("Họ tên: Nguyễn Văn An");
  expect(body).toContain("Chức vụ: Kế toán trưởng");
  expect(body).toContain("Bộ phận: Kế toán");
  expect(body).toContain("Người ký: Nguyễn Văn An");
  expect(body).not.toMatch(/\{\{|\}\}/);
  expect(await textOf(first as Uint8Array, "word/header1.xml")).toBe("Phòng Kế toán");
  expect(await textOf(first as Uint8Array, "word/footer1.xml")).toBe("Ký ngày 28/10/2026");
  // A mapped-but-empty cell is not a failure, and the right person is in the right file (the 10th file is row 11).
  const tenth = await zip.file(Object.keys(zip.files)[9] as string)?.async("uint8array");
  expect(await textOf(tenth as Uint8Array, "word/document.xml")).toContain("Họ tên: Trần Thị Bình");

  // The failed row is explained by its real cause (a hidden control character), not as a missing tag.
  await expect(page.getByTestId("invalid-value-hint")).toContainText("1 dòng có ô chứa ký tự");

  // The error report names only the bad row (data row 5) and has no source data.
  const reportPath = zipPath.replace(/\.zip$/, "-errors.csv");
  const report = await readFile(reportPath, "utf8");
  expect(report).toBe("row,error_code\r\n5,invalid-value\r\n");
  for (const [name, title, department] of PEOPLE) {
    for (const value of [name, title, department]) {
      expect(report).not.toContain(value?.replace("\u0001", "") ?? "?");
    }
  }

  // "Mở thư mục" and the report link ask the system to show the file, selected. The path never comes from the page.
  await page.getByRole("button", { name: "Mở thư mục" }).click();
  await page.getByRole("button", { name: "Xem báo cáo lỗi" }).click();
  await expect.poll(() => revealed(app)).toEqual([zipPath, reportPath]);

  // "Tạo đợt mới" clears everything: back to step 1 with no data loaded.
  await page.getByRole("button", { name: "Tạo đợt mới" }).click();
  await expect(step(page, "data")).toHaveAttribute("data-status", "active");
  await expect(step(page, "template")).toHaveAttribute("data-status", "locked");
  await expect(step(page, "export")).toHaveAttribute("data-status", "locked");
  await expect(page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ })).toBeVisible();
  await expect(page.getByTestId("file-name")).toHaveCount(0);

  // Run it again from the start: the second ZIP has its own name, nothing is overwritten.
  await toStepExport(app, page, csv);
  await page.getByRole("button", { name: "Xuất 12 file" }).click();
  await expect(page.getByTestId("done-title")).toHaveText("Đã tạo 11 file", { timeout: 45_000 });
  const second = (await page.getByTestId("zip-path").textContent()) ?? "";
  expect(second).not.toBe(zipPath);
  expect(await readdir(out)).toHaveLength(4);
  await app.close();
});

test("cancelling in the middle leaves no ZIP, no report and no temporary file", async () => {
  const big = join(work, "lon.csv");
  const rows = Array.from({ length: 4000 }, (_, i) => [
    `Người số ${i + 1}`,
    "Nhân viên",
    `Phòng ${i % 7}`,
  ]);
  writeCsv1258(big, [HEADER, ...rows]);
  const cancelOut = join(work, "out-cancel");
  mkdirSync(cancelOut, { recursive: true });

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, big);
  await answerDialog(app, cancelOut);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(cancelOut);

  await page.getByRole("button", { name: "Xuất 4000 file" }).click();
  const text = page.getByTestId("export-progress-text");
  await expect(text).toHaveText(/^Đang tạo file… [1-9]\d*\/4000$/);

  // The bar has a text equivalent.
  const bar = page.getByRole("progressbar", { name: "Tiến độ tạo file" });
  await expect(bar).toHaveAttribute("aria-valuemax", "4000");
  expect(Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expect(bar).toHaveAttribute("aria-valuetext", /^\d+ trên 4000 file$/);
  // While it runs, the earlier steps cannot be reopened (a click is bounced back to step 4).
  await page.getByRole("button", { name: "Đổi: Dữ liệu" }).click();
  await expect(step(page, "export")).toHaveAttribute("data-status", "active");
  await expect(page.getByTestId("export-running")).toBeVisible();
  await shoot(page, "flow", "exporting");
  // The ZIP is being streamed to a temporary file, so the cancel has something to clean up.
  expect((await stray(cancelOut)).length).toBe(1);
  await page.getByRole("button", { name: "Hủy" }).click();

  const notice = page.getByRole("alert").filter({ hasText: /Chưa lưu gì cả/ });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  // "Hủy" has gone: focus moved to the notice (an alert, so it is announced), not to the page body.
  await expect(notice).toBeFocused();
  await expect(page.getByRole("button", { name: "Xuất 4000 file" })).toBeVisible();
  await shoot(page, "flow", "canceled");
  expect(await readdir(cancelOut)).toEqual([]);
  await app.close();
  expect(await readdir(cancelOut)).toEqual([]);
});
