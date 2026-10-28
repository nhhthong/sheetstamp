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

const SHOTS = join(import.meta.dirname, "../../test-results/home-template");
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
    {
      stdio: "pipe",
    },
  );
}

const tag = (name: string, label: string) => ({ name, label });

let work: string;
let dataDir: string;
let csv: string;
let docx: string;

test.beforeAll(async () => {
  // Not in the system temp folder: home-data.spec.ts scans it for stray data files while specs run in parallel.
  mkdirSync(SHOTS, { recursive: true });
  work = mkdtempSync(join(SHOTS, "work-"));
  dataDir = join(work, "data");
  csv = join(work, "nhan-vien.csv");
  writeCsv(csv, [
    ["Họ tên", "CCCD", "Phòng ban"],
    ["Nguyễn Thị Hương", "012345678901", "Kế toán"],
    ["Trần Văn Đức", "012345678902", "Nhân sự"],
  ]);
  docx = join(work, "mau.docx");
  writeFileSync(docx, await makeDocx({ body: paragraph(run("Họ tên: {{ho_ten}}")) }));

  // Three templates in two groups, seeded through storage (the same code the app uses).
  const storage = await openStorage(dataDir);
  const groups = await storage.listGroups();
  const contract = groups.find((g) => g.name === "Hợp đồng")?.id;
  const leaving = groups.find((g) => g.name === "Nghỉ việc")?.id;
  const seed = (
    name: string,
    groupId: string | undefined,
    note: string,
    tags: { name: string; label: string }[],
  ) => storage.createTemplate({ name, kind: "word", groupId, note, tags, source: fileOf(docx) });
  await seed("Hợp đồng lao động", contract, "", [
    tag("ho_ten", "Họ và tên"),
    tag("cccd", "CCCD"),
    tag("ngay_sinh", "Ngày sinh"),
  ]); // 2 of 3
  await seed("Quyết định nghỉ việc", leaving, "Đính kèm bàn giao", [
    tag("ho_ten", "Họ và tên"),
    tag("ly_do", "Lý do"),
  ]); // 1 of 2
  await seed("Hợp đồng thử việc", contract, "", [
    tag("ho_ten", "Họ và tên"),
    tag("cccd", "CCCD"),
    tag("phong_ban", "Phòng ban"),
  ]); // 3 of 3
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

/** Load the CSV in step 1 and continue to step 2. */
async function toStepTemplate(app: ElectronApplication, page: Page) {
  await answerDialog(app, csv);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(page.getByTestId("file-name")).toHaveText("nhan-vien.csv");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.locator('li[data-step="template"]')).toHaveAttribute("data-status", "active");
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

const names = (page: Page) =>
  page.getByTestId("template-row").locator("span.font-bold").allTextContents();

test("step 2 searches without diacritics, ranks by column match, remembers the group chip", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepTemplate(app, page);

  // Best match first: 3/3, 2/3, 1/2. The primary button waits for a choice.
  const rows = page.getByTestId("template-row");
  await expect(rows).toHaveCount(3);
  expect(await names(page)).toEqual([
    "Hợp đồng thử việc",
    "Hợp đồng lao động",
    "Quyết định nghỉ việc",
  ]);
  await expect(page.getByTestId("template-hint").nth(0)).toHaveText("Khớp 3/3 trường, chưa dùng");
  await expect(page.getByTestId("template-hint").nth(1)).toHaveText("Khớp 2/3 trường, chưa dùng");
  await expect(page.getByTestId("template-hint").nth(2)).toHaveText("Khớp 1/2 trường, chưa dùng");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
  await shoot(page, "list");

  // Search ignores diacritics and looks at name and group, and at the note.
  const search = page.getByLabel("Tìm mẫu theo tên, nhóm hoặc ghi chú");
  await search.fill("hop dong");
  expect(await names(page)).toEqual(["Hợp đồng thử việc", "Hợp đồng lao động"]);
  await search.fill("DINH KEM");
  expect(await names(page)).toEqual(["Quyết định nghỉ việc"]);
  await search.fill("khong co");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText(/Không có mẫu nào khớp/)).toBeVisible();
  await search.fill("");

  // Group chips; the last one is remembered.
  await page.getByRole("button", { name: "Nghỉ việc", exact: true }).click();
  expect(await names(page)).toEqual(["Quyết định nghỉ việc"]);

  // One template at a time, and the summary shows name and group.
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await rows.nth(1).click();
  await rows.nth(0).click();
  await expect(rows.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.locator('li[data-step="template"]')).toHaveAttribute("data-status", "done");
  await expect(page.locator('li[data-step="template"]')).toContainText(
    "Hợp đồng thử việc (Hợp đồng)",
  );
  await expect(page.locator('li[data-step="mapping"]')).toHaveAttribute("data-status", "active");

  // The template is marked as used: reopen the step and it hints a date, and ranks above equal fits.
  await page.locator('li[data-step="template"]').getByRole("button", { name: /^Đổi/ }).click();
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await expect(page.getByTestId("template-hint").first()).toHaveText(/Khớp 3\/3 trường, dùng \d/);

  await app.close();
});

test("the remembered chip survives a restart", async () => {
  let app = await launch();
  let page = await app.firstWindow();
  await toStepTemplate(app, page);
  await page.getByRole("button", { name: "Nghỉ việc", exact: true }).click();
  await expect(page.getByTestId("template-row")).toHaveCount(1);
  // The choice is saved in the background; closing at once can beat the write (seen on Windows runners).
  // Storage commits its memory only after the file is written, so a stored value means it is on disk.
  await expect
    .poll(() => page.evaluate(() => window.sheetstamp.invoke("mapping:getGroupFilter")))
    .not.toBeNull();
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await toStepTemplate(app, page);
  await expect(page.getByRole("button", { name: "Nghỉ việc", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("template-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await app.close();
});

test("a template can be created from inside the step and is then selectable", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepTemplate(app, page);

  await answerDialog(app, docx);
  await page.getByRole("button", { name: "+ Mẫu mới" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Chọn file…" }).click();
  await dialog.getByLabel("Tên mẫu").fill("Giấy xác nhận");
  await shoot(page, "dialog");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(dialog).toBeHidden();

  // Still in the flow, the new template is in the list and already selected.
  await expect(page.locator('li[data-step="template"]')).toHaveAttribute("data-status", "active");
  const created = page.getByTestId("template-row").filter({ hasText: "Giấy xác nhận" });
  await expect(created).toHaveCount(1);
  await expect(created).toHaveAttribute("aria-pressed", "true");
  await expect(created.getByTestId("template-hint")).toHaveText("Khớp 1/1 trường, chưa dùng");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await app.close();
});
