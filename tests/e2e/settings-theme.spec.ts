// T-34: the theme choice in Cài đặt is applied at once, remembered across restarts and follows the system.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

const DARK_BG = "rgb(20, 23, 28)";
const LIGHT_BG = "rgb(255, 255, 255)";

const openSettings = async (page: Page) => {
  await page.getByRole("navigation").getByRole("button", { name: "Cài đặt" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cài đặt");
};
const pick = (page: Page, name: string) =>
  page.getByRole("group", { name: "Giao diện" }).getByText(name, { exact: true }).click();
const dataTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const prefersDark = (page: Page) =>
  page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);

test("Sáng, Tối and Theo hệ thống work, are remembered, and System follows the OS live", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-theme-"));

  // Default: Theo hệ thống, no attribute.
  let app = await launch(dataDir);
  let page = await app.firstWindow();
  await openSettings(page);
  await expect(page.getByRole("radio", { name: "Theo hệ thống" })).toBeChecked();
  expect(await dataTheme(page)).toBeUndefined();

  // Tối.
  await pick(page, "Tối");
  await expect.poll(() => dataTheme(page)).toBe("dark");
  await expect(page.getByRole("radio", { name: "Tối" })).toBeChecked();
  expect(await background(page)).toBe(DARK_BG);
  expect(JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf8")).data).toEqual({
    theme: "dark",
  });
  await app.close();

  // Restart: still dark, and main set the colour scheme before the window was created (no light first frame).
  app = await launch(dataDir);
  page = await app.firstWindow();
  expect(
    await app.evaluate(({ nativeTheme }) => [
      nativeTheme.themeSource,
      nativeTheme.shouldUseDarkColors,
    ]),
  ).toEqual(["dark", true]);
  // Playwright pins prefers-color-scheme to "light" by default; drop that so the real value shows.
  await page.emulateMedia({ colorScheme: null });
  await expect.poll(() => prefersDark(page)).toBe(true);
  await expect.poll(() => background(page)).toBe(DARK_BG);
  await expect.poll(() => dataTheme(page)).toBe("dark");
  await openSettings(page);
  await expect(page.getByRole("radio", { name: "Tối" })).toBeChecked();

  // Sáng wins over a dark system.
  await pick(page, "Sáng");
  await expect.poll(() => dataTheme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).toBe(LIGHT_BG);

  // Theo hệ thống: the page follows the emulated OS scheme, both ways, without a reload.
  await pick(page, "Theo hệ thống");
  await expect.poll(() => dataTheme(page)).toBeUndefined();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).toBe(DARK_BG);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => background(page)).toBe(LIGHT_BG);
  await app.close();
});

test("a corrupt settings file starts with Theo hệ thống", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-theme-"));
  writeFileSync(join(dataDir, "settings.json"), '{"schemaVersion": 1, "data": {oops');
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await openSettings(page);
  await expect(page.getByRole("radio", { name: "Theo hệ thống" })).toBeChecked();
  expect(await dataTheme(page)).toBeUndefined();
  await app.close();
});
