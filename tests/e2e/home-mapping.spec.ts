import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { makeDocx, paragraph, run } from "../../src/main/selftest/make-docx";
import { openStorage } from "../../src/main/storage";
import { fileOf } from "./file-of";

const SHOTS = join(import.meta.dirname, "../../test-results/home-mapping");
const MAKE_DATA = join(import.meta.dirname, "../fixtures/data/make-data.ts");

/** Same approach as home-data.spec.ts: exceljs cannot load in the Playwright loader, so run the helper in Node. */
function writeCsv(path: string, rows: string[][]) {
  const script = `
    const { writeFileSync } = await import("node:fs");
    const m = await import(${JSON.stringify(pathToFileURL(MAKE_DATA).href)});
    const [path, json] = process.argv.slice(1);
    writeFileSync(path, m.encodeWindows1258(m.toCsv(JSON.parse(json))));
  `;
  execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script, path, JSON.stringify(rows)],
    { stdio: "pipe" },
  );
}

const PEOPLE = [
  ["Nguyễn Văn An", "012345678901", "Hà Nam"],
  ["Trần Thị Bình", "012345678902", "Nghệ An"],
  ["Lê Minh Châu", "", "Huế"],
  ["Phạm Quốc Đạt", "012345678904", "Cần Thơ"],
  ["Võ Thanh Hà", "012345678905", "Đà Lạt"],
];

const FIRST_MAPPING = {
  ho_ten: { kind: "column" as const, column: "Họ tên" },
  cccd: { kind: "column" as const, column: "CCCD" },
  noi_sinh: { kind: "column" as const, column: "Vùng miền" },
};

let work: string;
let dataDir: string;
let csv: string;
let csvOther: string;
let templateId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Not in the system temp folder: home-data.spec.ts scans it for stray data files while specs run in parallel.
  mkdirSync(SHOTS, { recursive: true });
  work = mkdtempSync(join(SHOTS, "work-"));
  dataDir = join(work, "data");
  csv = join(work, "nhan-vien.csv");
  // "Vùng miền" is the oddly named column: no rule links it to the field "Nơi sinh".
  writeCsv(csv, [["Họ tên", "CCCD", "Vùng miền"], ...PEOPLE]);
  csvOther = join(work, "nhan-vien-moi.csv");
  // No CCCD column any more.
  writeCsv(csvOther, [
    ["Họ tên", "Vùng miền", "Ghi chú"],
    ["Đinh Công Em", "Hải Phòng", "x"],
  ]);
  const docx = join(work, "mau.docx");
  writeFileSync(
    docx,
    await makeDocx({
      body:
        paragraph(run("Họ tên: {{ho_ten}}")) +
        paragraph(run("CCCD: {{cccd}}")) +
        paragraph(run("Nơi sinh: {{noi_sinh}}")),
    }),
  );
  const storage = await openStorage(dataDir);
  const made = await storage.createTemplate({
    name: "Giấy xác nhận",
    kind: "word",
    source: fileOf(docx),
    tags: [
      { name: "ho_ten", label: "Họ và tên" },
      { name: "cccd", label: "CCCD" },
      { name: "noi_sinh", label: "Nơi sinh" },
    ],
  });
  templateId = made.id;
});

test.afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const launch = () =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

const answerDialog = (app: ElectronApplication, path: string) =>
  app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [chosen],
    })) as never;
  }, path);

const step = (page: Page, id: string) => page.locator(`li[data-step="${id}"]`);
const next = (page: Page) => page.getByRole("button", { name: "Tiếp tục" });

/** Load the CSV, pick the template and arrive in step 3. */
async function toStepMapping(app: ElectronApplication, page: Page, file = csv) {
  await answerDialog(app, file);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(page.getByTestId("file-name")).toHaveText(/\.csv$/);
  await next(page).click();
  await page.getByTestId("template-row").filter({ hasText: "Giấy xác nhận" }).click();
  await next(page).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");
}

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

const heading = (page: Page) => page.getByTestId("mapping-heading");
const preview = (page: Page) => page.getByTestId("mapping-preview");

test("auto-matching leaves the odd column, the user fixes it, pages through rows and continues", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepMapping(app, page);

  // Exactly one field is left: highlighted, with marker text, explanation and a disabled primary button.
  await expect(heading(page)).toHaveText("1 trường cần bạn chọn cột.");
  const rows = page.getByTestId("mapping-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toHaveAttribute("data-field", "Nơi sinh");
  await expect(rows.first()).toHaveAttribute("data-state", "unresolved");
  await expect(rows.first()).toContainText("Cần chọn cột");
  await expect(rows.first()).toContainText(
    "Chưa có cột nào giống ‘Nơi sinh’. Chọn cột khác, nhập chữ cố định hoặc để trống.",
  );
  await expect(next(page)).toBeDisabled();
  await expect(page.getByTestId("mapping-row")).toHaveCount(3);

  // The preview already shows row 1: matched values filled, the unmapped field marked.
  await expect(page.getByTestId("pager")).toHaveText("Dòng 1/5");
  await expect(page.getByTestId("zoom")).toHaveText("100%");
  await page.getByRole("button", { name: "Phóng to" }).click();
  await expect(page.getByTestId("zoom")).toHaveText("125%");
  await page.getByRole("button", { name: "Về 100%" }).click();
  await expect(preview(page)).toContainText("Nguyễn Văn An");
  await expect(preview(page)).toContainText("012345678901");
  await expect(preview(page)).toContainText("(thiếu)");
  await shoot(page, "unmatched");

  // The dropdown offers the placeholder, every column, fixed text and empty.
  const select = rows.first().getByRole("combobox");
  expect(await select.locator("option").allTextContents()).toEqual([
    "Chọn cột…",
    "Họ tên",
    "CCCD",
    "Vùng miền",
    "Nhập chữ cố định",
    "Để trống",
  ]);

  // Fix it by hand: the preview updates at once, the heading and the button follow.
  await select.selectOption({ label: "Vùng miền" });
  await expect(preview(page)).toContainText("Hà Nam");
  await expect(preview(page)).not.toContainText("(thiếu)");
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await expect(rows.first()).toHaveAttribute("data-state", "resolved");
  await expect(next(page)).toBeEnabled();

  // Page through the rows; one row at a time, each well under 500 ms.
  const prev = page.getByRole("button", { name: "Dòng trước" });
  const forward = page.getByRole("button", { name: "Dòng sau" });
  await expect(prev).toBeDisabled();
  const timings: number[] = [];
  for (const [i, name] of [
    [2, "Trần Thị Bình"],
    [3, "Lê Minh Châu"],
    [4, "Phạm Quốc Đạt"],
    [5, "Võ Thanh Hà"],
  ] as const) {
    const started = Date.now();
    await forward.click();
    await expect(page.getByTestId("pager")).toHaveText(`Dòng ${i}/5`);
    await expect(preview(page)).toContainText(name);
    timings.push(Date.now() - started);
  }
  console.log("row change ms", timings.join(", "));
  expect(Math.max(...timings)).toBeLessThan(500);
  await expect(forward).toBeDisabled();
  await prev.click();
  await prev.click();
  await expect(page.getByTestId("pager")).toHaveText("Dòng 3/5");
  // Row 3 has an empty CCCD cell: an empty value, not a missing field.
  await expect(preview(page)).toContainText("Lê Minh Châu");
  await expect(preview(page).locator(".ss-empty")).toHaveCount(1);
  await expect(preview(page)).not.toContainText("(thiếu)");
  await shoot(page, "resolved");

  await next(page).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "done");
  await expect(step(page, "mapping")).toContainText("3 trường đã ghép");
  await expect(step(page, "export")).toHaveAttribute("data-status", "active");
  await app.close();

  // The mapping is saved with the template as a flat record.
  const storage = await openStorage(dataDir);
  expect((await storage.getTemplate(templateId))?.mapping).toEqual(FIRST_MAPPING);
});

test("the saved mapping is reused after a restart; changing the data keeps valid choices and names the lost field", async () => {
  let app = await launch();
  let page = await app.firstWindow();
  await toStepMapping(app, page);
  // Same template, same data: nothing to fix.
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await expect(page.locator('[data-testid="mapping-row"][data-state="unresolved"]')).toHaveCount(0);
  await expect(next(page)).toBeEnabled();
  await expect(page.getByTestId("lost-fields")).toHaveCount(0);
  await expect(page.getByTestId("mapping-row")).toHaveCount(3);
  await next(page).click();
  await expect(step(page, "export")).toHaveAttribute("data-status", "active");

  // Change the data file: the new one has no CCCD column.
  await step(page, "data").getByRole("button", { name: /^Đổi/ }).click();
  await answerDialog(app, csvOther);
  await page.getByRole("button", { name: "Chọn file khác" }).click();
  await expect(page.getByTestId("file-name")).toHaveText("nhan-vien-moi.csv");
  await next(page).click();

  // Back in step 3 with the valid choices kept and the lost field named.
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");
  await expect(step(page, "template")).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("lost-fields")).toContainText(
    "Trường ‘CCCD’ mất cột ‘CCCD’. Chọn cột khác.",
  );
  await expect(heading(page)).toHaveText("1 trường cần bạn chọn cột.");
  const unresolved = page.locator('[data-testid="mapping-row"][data-state="unresolved"]');
  await expect(unresolved).toHaveCount(1);
  await expect(unresolved).toHaveAttribute("data-field", "CCCD");
  await expect(next(page)).toBeDisabled();
  await expect(page.getByTestId("mapping-row")).toHaveCount(3);
  await expect(page.getByTestId("pager")).toHaveText("Dòng 1/1");
  await expect(page.getByRole("button", { name: "Dòng trước" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Dòng sau" })).toBeDisabled();
  await expect(preview(page)).toContainText("Đinh Công Em");
  await expect(preview(page)).toContainText("Hải Phòng");
  await shoot(page, "lost");

  // Leaving it empty settles the field.
  await unresolved.getByRole("combobox").selectOption({ label: "Để trống" });
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await expect(next(page)).toBeEnabled();
  await app.close();

  // Restart on the new data: the empty choice was saved.
  app = await launch();
  page = await app.firstWindow();
  await toStepMapping(app, page, csvOther);
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await expect(page.getByTestId("lost-fields")).toHaveCount(0);
  await app.close();

  // Put the first data's mapping back for the next test.
  const storage = await openStorage(dataDir);
  await storage.updateTemplate(templateId, { mapping: FIRST_MAPPING });
});

test("fixed text previews as you type and is saved; narrow window stacks the columns", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1200, 900));
  await toStepMapping(app, page);

  // Change a matched field to fixed text: unresolved until something is typed.
  const row = page.getByTestId("mapping-row").filter({ hasText: "Nơi sinh" });
  await row.getByRole("combobox").selectOption({ label: "Nhập chữ cố định" });
  await expect(heading(page)).toHaveText("1 trường cần bạn chọn cột.");
  await expect(next(page)).toBeDisabled();
  await row.getByRole("textbox", { name: "Chữ cố định cho trường Nơi sinh" }).fill("Việt Nam");
  await expect(preview(page)).toContainText("Việt Nam");
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await expect(next(page)).toBeEnabled();
  await shoot(page, "fixed");

  // Narrow window: the preview goes below the list (no horizontal scroll on the page).
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(700, 900));
  await page.waitForTimeout(500);
  const listBox = await page.getByTestId("mapping-heading").boundingBox();
  const previewBox = await page.getByTestId("pager").boundingBox();
  expect(previewBox?.y ?? 0).toBeGreaterThan((listBox?.y ?? 0) + 100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await shoot(page, "narrow");

  // Wait for the debounced save, then check what is stored.
  await expect
    .poll(async () => {
      const storage = await openStorage(dataDir);
      return (await storage.getTemplate(templateId))?.mapping.noi_sinh;
    })
    .toEqual({ kind: "fixed", text: "Việt Nam" });
  await app.close();
});

test("every row shows its first-row value, and a column taken by another field is moved with an alert", async () => {
  const storage = await openStorage(dataDir);
  await storage.updateTemplate(templateId, { mapping: {} });
  const app = await launch();
  const page = await app.firstWindow();
  await toStepMapping(app, page);

  const rows = page.getByTestId("mapping-row");
  const nameRow = rows.filter({ hasText: "Họ và tên" });
  await expect(nameRow.getByTestId("first-value")).toHaveText("Dòng đầu: Nguyễn Văn An");

  // The odd field takes the column "Họ tên" from the field that had it.
  const birthRow = rows.filter({ hasText: "Nơi sinh" });
  await birthRow.getByRole("combobox").selectOption({ label: "Họ tên" });
  await expect(birthRow.getByTestId("first-value")).toHaveText("Dòng đầu: Nguyễn Văn An");
  await expect(nameRow).toHaveAttribute("data-state", "unresolved");
  await expect(nameRow).toContainText("Cột này đã chuyển sang trường khác.");
  await expect(nameRow.getByTestId("first-value")).toHaveCount(0);
  await expect(heading(page)).toHaveText("1 trường cần bạn chọn cột.");
  await expect(next(page)).toBeDisabled();
  await shoot(page, "column-taken");

  // Choosing again clears the alert.
  await nameRow.getByRole("combobox").selectOption({ label: "Vùng miền" });
  await expect(nameRow).not.toContainText("Cột này đã chuyển sang trường khác");
  await expect(heading(page)).toHaveText("Tất cả 3 trường đã ghép.");
  await app.close();
});

test("Start over asks first, keeps everything on cancel and returns to step 1 on confirm", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await expect(page.getByRole("button", { name: "Làm lại từ đầu" })).toHaveCount(0);
  await toStepMapping(app, page);

  await page.getByRole("button", { name: "Làm lại từ đầu" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");

  await page.getByRole("button", { name: "Làm lại từ đầu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Làm lại", exact: true }).click();
  await expect(step(page, "data")).toHaveAttribute("data-status", "active");
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("file-name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Làm lại từ đầu" })).toHaveCount(0);
  await app.close();
});
