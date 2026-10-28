// Helpers shared by tests/e2e/home-export.spec.ts and tests/e2e/flow.spec.ts: generated fixtures and the Home flow.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from "@playwright/test";
import { makeDocx, paragraph, run, table } from "../../src/main/selftest/make-docx";
import { openStorage } from "../../src/main/storage";

const MAKE_DATA = join(import.meta.dirname, "../fixtures/data/make-data.ts");

/** Specs run in parallel and home-data.spec.ts scans the system temp folder, so fixtures live under test-results. */
export function workFolder(name: string): string {
  const root = join(import.meta.dirname, "../../test-results", name);
  mkdirSync(root, { recursive: true });
  return mkdtempSync(join(root, "work-"));
}

/** exceljs cannot load in the Playwright loader, so the helper of make-data.ts runs in a plain Node process. */
export function writeCsv1258(path: string, rows: string[][]): void {
  const script = `
    const { readFileSync, writeFileSync } = await import("node:fs");
    const m = await import(${JSON.stringify(pathToFileURL(MAKE_DATA).href)});
    const [path] = process.argv.slice(1);
    writeFileSync(path, m.encodeWindows1258(m.toCsv(JSON.parse(readFileSync(0, "utf8")))));
  `;
  // The rows go through stdin: 4,000 rows do not fit in the arguments.
  execFileSync(process.execPath, ["--input-type=module", "-e", script, path], {
    input: JSON.stringify(rows),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export const HEADER = ["Họ tên", "Chức vụ", "Phòng ban"];

/** Twelve Vietnamese rows. Row 5 has a control character in "Chức vụ": a value the Word file cannot hold, so it fails. */
export const PEOPLE: string[][] = [
  ["Nguyễn Văn An", "Kế toán trưởng", "Kế toán"],
  ["Trần Thị Bình", "Nhân viên", "Nhân sự"],
  ["Lê Minh Châu", "Chuyên viên", "Kinh doanh"],
  ["Phạm Quốc Đạt", "Thủ kho", "Kho vận"],
  ["Võ Thanh Hà", "Bảo\u0001vệ", "Hành chính"],
  ["Đặng Thùy Dương", "Lễ tân", "Hành chính"],
  ["Hoàng Gia Huy", "Lái xe", "Kho vận"],
  ["Bùi Ngọc Ánh", "Kế toán viên", "Kế toán"],
  ["Ngô Quang Vinh", "Giám sát", "Kinh doanh"],
  ["Đinh Tuấn Kiệt", "Nhân viên", "Nhân sự"],
  // The same person and department as row 2: the third file name must get " (2)".
  ["Trần Thị Bình", "Nhân viên", "Nhân sự"],
  ["Lý Hoài Thương", "Thực tập", "Kế toán"],
];

export const NEW_TEMPLATE_FIELDS = [
  { name: "ho_ten", label: "Họ tên" },
  { name: "chuc_vu", label: "Chức vụ" },
  { name: "phong_ban", label: "Phòng ban" },
  { name: "ngay_ky", label: "Ngày ký" },
];

/** A Word template with tags split over runs, a table, a header and a footer. */
export async function writeTemplate(path: string): Promise<void> {
  writeFileSync(
    path,
    await makeDocx({
      header: paragraph(run("Phòng {{phong"), run("_ban}}")),
      body:
        paragraph(run("Họ tên: {{ho"), run("_ten", true), run("}}")) +
        paragraph(run("Chức vụ: {{chuc_vu}}")) +
        table(
          paragraph(run("Bộ phận: {{phong_"), run("ban}}", true)),
          paragraph(run("Người ký: {{ho_ten}}")),
        ),
      footer: paragraph(run("Ký ngày {{ngay_ky}}")),
    }),
  );
}

/** Put a template in a data folder before the app starts. Returns its id. */
export async function seedTemplate(
  dataDir: string,
  docx: string,
  name = "Hợp đồng thử việc",
): Promise<string> {
  const storage = await openStorage(dataDir);
  const made = await storage.createTemplate({
    name,
    kind: "word",
    sourcePath: docx,
    tags: NEW_TEMPLATE_FIELDS,
  });
  return made.id;
}

export const launch = (dataDir: string): Promise<ElectronApplication> =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

/** Answer every native open dialog (file or folder picker) with `path`. */
export const answerDialog = (app: ElectronApplication, path: string) =>
  app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as never;
  }, path);

export const step = (page: Page, id: string) => page.locator(`li[data-step="${id}"]`);
export const next = (page: Page) => page.getByRole("button", { name: "Tiếp tục" });

/** Steps 1 to 3: load the CSV, pick the template, give "Ngày ký" a fixed text. Ends in step 4. */
export async function toStepExport(
  app: ElectronApplication,
  page: Page,
  csv: string,
  templateName = "Hợp đồng thử việc",
) {
  await answerDialog(app, csv);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(page.getByTestId("file-name")).toHaveText(/\.csv$/);
  await next(page).click();
  await page.getByTestId("template-row").filter({ hasText: templateName }).click();
  await next(page).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");
  // One field has no column: fix it by hand with a fixed text (the choice is stored, so a second run finds it done).
  await expect(page.getByTestId("mapping-heading")).toBeVisible();
  const row = page.getByTestId("mapping-row").filter({ hasText: "Ngày ký" });
  if ((await row.count()) > 0) {
    await row.getByRole("combobox").selectOption({ label: "Nhập chữ cố định" });
    await row.getByRole("textbox").fill("28/10/2026");
  }
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  await expect(step(page, "export")).toHaveAttribute("data-status", "active");
}

/** Screenshots in light and dark of the current page. */
export async function shoot(page: Page, folder: string, name: string) {
  const dir = join(import.meta.dirname, "../../test-results", folder);
  mkdirSync(dir, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(dir, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

/** Record what `shell.showItemInFolder` is asked to show, in main. */
export const recordReveals = (app: ElectronApplication) =>
  app.evaluate(({ shell }) => {
    const seen: string[] = [];
    (globalThis as unknown as { __revealed: string[] }).__revealed = seen;
    shell.showItemInFolder = ((path: string) => {
      seen.push(path);
    }) as never;
  });

export const revealed = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { __revealed: string[] }).__revealed);
