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
import { openStorage } from "../../src/main/storage";
import { fileOf } from "./file-of";

const SHOTS = join(import.meta.dirname, "../../test-results/home-image-templates");
const MAKE_DATA = join(import.meta.dirname, "../fixtures/data/make-data.ts");
const BACKGROUND = join(import.meta.dirname, "../fixtures/image/golden/four-styles.png");

/** Same approach as home-mapping.spec.ts: exceljs cannot load in the Playwright loader, so run the helper in Node. */
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

// Image fields take the columns by position: the file has three columns, so the fourth field has none.
const ROWS = [
  ["Họ tên", "CCCD", "Vùng miền"],
  ["Nguyễn Văn An", "012345678901", "Hà Nam"],
  ["Trần Thị Bình", "012345678902", "Nghệ An"],
  ["Lê Minh Châu", "012345678903", "Huế"],
  ["Phạm Quốc Đạt", "012345678904", "Cần Thơ"],
];

const box = (id: string, field: string, y: number, fontFamily = "Sheetstamp Test") => ({
  id,
  field,
  x: 10,
  y,
  width: 300,
  fontSize: 24,
  fontFamily,
  style: "normal" as const,
  color: "#c00000",
  align: "left" as const,
  maxLines: 1,
  overflow: "shrink" as const,
});

const FIELDS = [
  { name: "ho_ten", label: "Họ và tên" },
  { name: "cccd", label: "CCCD" },
  { name: "noi_sinh", label: "Nơi sinh" },
  { name: "ghi_chu", label: "Ghi chú" },
];

let work: string;
let dataDir: string;
let csv: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  work = mkdtempSync(join(SHOTS, "work-"));
  dataDir = join(work, "data");
  csv = join(work, "nhan-vien.csv");
  writeCsv(csv, ROWS);
  const storage = await openStorage(dataDir);
  const image = (name: string, boxes: ReturnType<typeof box>[], tags = FIELDS) =>
    storage.createTemplate({
      name,
      kind: "image",
      imageLayout: { version: 1, boxes },
      tags: boxes.length === 0 ? [] : tags,
      source: fileOf(BACKGROUND),
    });
  await image("Giấy khen", [
    box("a", "ho_ten", 10),
    box("b", "cccd", 50),
    box("c", "noi_sinh", 90),
    box("d", "ghi_chu", 130),
  ]);
  await image("Giấy trống", []);
  await image(
    "Giấy font lạ",
    [box("a", "ho_ten", 10, "Font Không Có"), box("b", "cccd", 50, "Font Không Có")],
    FIELDS.slice(0, 2),
  );
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
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as never;
  }, path);

const step = (page: Page, id: string) => page.locator(`li[data-step="${id}"]`);
const next = (page: Page) => page.getByRole("button", { name: "Tiếp tục" });
const row = (page: Page, name: string) =>
  page.getByTestId("template-row").filter({ hasText: name });

async function toStepTemplate(app: ElectronApplication, page: Page) {
  await answerDialog(app, csv);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(page.getByTestId("file-name")).toHaveText(/\.csv$/);
  await next(page).click();
  await expect(step(page, "template")).toHaveAttribute("data-status", "active");
}

async function toStepMapping(app: ElectronApplication, page: Page, name: string) {
  await toStepTemplate(app, page);
  await row(page, name).click();
  await next(page).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");
}

const shown = (page: Page) => page.getByTestId("mapping-image");
const srcOf = (page: Page) => shown(page).getAttribute("src");

test("an image template is listed with its icon and fit, mapped, and the real image follows the row and the mapping", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepTemplate(app, page);

  const item = row(page, "Giấy khen");
  await expect(item.getByTestId("template-icon-image")).toBeVisible();
  await expect(item.getByTestId("template-hint")).toContainText("Khớp 3/4 trường");
  await item.click();
  await next(page).click();
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "active");

  await expect(page.getByTestId("mapping-heading")).toHaveText("1 trường cần bạn chọn cột.");
  await expect(next(page)).toBeDisabled();
  await expect(shown(page)).toBeVisible();
  await expect(page.getByTestId("image-unmapped")).toContainText("Ghi chú");
  const first = await srcOf(page);

  // Settle the field that has no column with fixed text: the image is drawn again, the note goes.
  await page
    .getByTestId("mapping-row")
    .first()
    .getByRole("combobox")
    .selectOption({ label: "Nhập chữ cố định" });
  await page.getByLabel("Chữ cố định cho trường Ghi chú").fill("Đạt");
  await expect(page.getByTestId("image-unmapped")).toHaveCount(0);
  await expect(page.getByTestId("mapping-heading")).toHaveText("Tất cả 4 trường đã ghép.");
  await expect.poll(() => srcOf(page)).not.toBe(first);
  await expect(next(page)).toBeEnabled();

  // The pager shows the next row, drawn with its values.
  const second = await srcOf(page);
  await page.getByRole("button", { name: "Dòng sau" }).click();
  await expect(page.getByTestId("pager")).toHaveText("Dòng 2/4");
  await expect.poll(() => srcOf(page)).not.toBe(second);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, "image-mapping.png") });

  // "Để trống" counts as resolved and draws nothing for that field.
  const withText = await srcOf(page);
  await page.getByLabel("Cột cho trường CCCD").selectOption({ label: "Để trống" });
  await expect.poll(() => srcOf(page)).not.toBe(withText);
  await expect(next(page)).toBeEnabled();
  await page.getByLabel("Cột cho trường CCCD").selectOption({ label: "CCCD" });
  await app.close();
});

test("the saved profile comes back when the image template is chosen again", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepMapping(app, page, "Giấy khen");
  await expect(page.getByTestId("mapping-heading")).toHaveText("Tất cả 4 trường đã ghép.");
  await expect(shown(page)).toBeVisible();
  await expect(next(page)).toBeEnabled();
  await app.close();
});

test("a template without boxes cannot continue and says why", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepTemplate(app, page);
  await expect(row(page, "Giấy trống").getByTestId("template-hint")).toContainText(
    "Chưa có trường nào",
  );
  await row(page, "Giấy trống").click();
  await next(page).click();
  await expect(page.getByText("Mẫu này chưa có khung chữ. Mở mẫu để thêm.")).toBeVisible();
  await expect(step(page, "template")).toHaveAttribute("data-status", "active");
  await app.close();
});

test("a missing font is reported inline in step 3 with the fix", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await toStepMapping(app, page, "Giấy font lạ");
  await expect(page.getByText(/Font “Font Không Có” không còn trên máy này/)).toBeVisible();
  await expect(page.getByText(/chọn font khác cho khung chữ dùng nó/)).toBeVisible();
  await app.close();
});
