// Review finding 4: what opening the data folder found reaches the user (Mẫu page and Home step 2).
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";

const SHOTS = join(import.meta.dirname, "../../test-results/templates-storage");

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

type App = Awaited<ReturnType<typeof launch>>;

const openTemplates = (page: Page) =>
  page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

/** Loads a small CSV in step 1 and continues to step 2. */
async function toStepTemplate(app: App, page: Page, csv: string) {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as never;
  }, csv);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(page.getByTestId("file-name")).toHaveText("nv.csv");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.locator('li[data-step="template"]')).toHaveAttribute("data-status", "active");
}

function workDir() {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-storage-"));
  const dataDir = join(work, "data");
  mkdirSync(dataDir);
  const csv = join(work, "nv.csv");
  writeFileSync(csv, "Họ tên\nAn\n");
  return { dataDir, csv };
}

test("a corrupt templates.json: renamed to .bak, empty library, banner on both screens", async () => {
  const { dataDir, csv } = workDir();
  const broken = '{"schemaVersion": 1, "data": [ {oops';
  writeFileSync(join(dataDir, "templates.json"), broken);

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await openTemplates(page);
  const banner = page.getByTestId("storage-banner");
  await expect(banner).toContainText("templates.json");
  await expect(banner).toContainText("templates.json.bak");
  await expect(banner.getByRole("alert")).toHaveCount(1);
  await expect(page.getByText("Chưa có mẫu tài liệu nào.")).toBeVisible();
  await expect(page.getByTestId("template-row")).toHaveCount(0);
  // The library still works: the app started with an empty one.
  await expect(page.getByRole("button", { name: "+ Mẫu mới" })).toBeEnabled();
  await shoot(page, "corrupt");

  await page.getByRole("navigation").getByRole("button", { name: "Tạo file" }).click();
  await toStepTemplate(app, page, csv);
  await expect(page.getByTestId("storage-banner")).toContainText("templates.json.bak");
  await app.close();

  expect(readFileSync(join(dataDir, "templates.json.bak"), "utf8")).toBe(broken);
  expect(readdirSync(dataDir).filter((f) => f.startsWith("templates.json.bak"))).toEqual([
    "templates.json.bak",
  ]);
});

test("step 1: a failing check of the open file shows a message instead of hanging", async () => {
  const { dataDir } = workDir();
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await expect(page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ })).toBeVisible();
  // Main now rejects the "what is open" question; the window regains focus.
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("data:current");
    ipcMain.handle("data:current", () => {
      throw new Error("boom");
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ })).toBeVisible();
  await app.close();
});

test("a newer schema: banner, nothing offered, the file is untouched", async () => {
  const { dataDir, csv } = workDir();
  const newer = `${JSON.stringify({ schemaVersion: 99, data: [{ future: true }] }, null, 2)}\n`;
  writeFileSync(join(dataDir, "templates.json"), newer);

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await openTemplates(page);
  const banner = page.getByTestId("storage-banner");
  await expect(banner.getByRole("alert")).toContainText("phiên bản Sheetstamp mới hơn");
  await expect(page.getByRole("button", { name: "+ Mẫu mới" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Quản lý nhóm" })).toBeDisabled();
  await expect(page.getByTestId("template-row")).toHaveCount(0);
  await expect(page.getByText("Chưa có mẫu tài liệu nào.")).toHaveCount(0);
  await shoot(page, "newer-schema");

  await page.getByRole("navigation").getByRole("button", { name: "Tạo file" }).click();
  await toStepTemplate(app, page, csv);
  await expect(page.getByTestId("storage-banner")).toContainText("phiên bản Sheetstamp mới hơn");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toHaveCount(0);
  await app.close();

  expect(readFileSync(join(dataDir, "templates.json"), "utf8")).toBe(newer);
  expect(readdirSync(dataDir).filter((f) => f.includes(".bak"))).toEqual([]);
  expect(existsSync(join(dataDir, "groups.json"))).toBe(false);
});
