// The interface language: English by default, switched in Cài đặt / Settings, kept across restarts.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    // An empty value is no override: main reads the language from settings.json.
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir, SHEETSTAMP_LANG: "" },
  });

test("English by default; the choice in Settings reloads the page, is saved and survives a restart", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-lang-"));

  let app = await launch(dataDir);
  let page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("button")).toHaveText(["Create files", "Templates", "Settings"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create files in bulk");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");

  // The first groups of a fresh data folder are named in the language in force.
  await nav.getByRole("button", { name: "Templates" }).click();
  await page.getByRole("button", { name: "Manage groups" }).click();
  await expect(page.getByRole("dialog")).toContainText("Contracts");
  await page.getByRole("button", { name: "Done" }).click();

  await nav.getByRole("button", { name: "Settings" }).click();
  const language = page.getByRole("group", { name: "Language" });
  await expect(language.getByRole("radio", { name: "English" })).toBeChecked();
  await language.getByText("Tiếng Việt").click();

  // The page reloads in Vietnamese.
  const navVi = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(navVi.getByRole("button")).toHaveText(["Tạo file", "Mẫu", "Cài đặt"]);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("vi");
  expect(JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf8")).data.language).toBe("vi");
  await app.close();

  // Restart: still Vietnamese, and the groups created earlier keep their English names.
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tạo file hàng loạt");
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("button", { name: "Mẫu" })
    .click();
  await page.getByRole("button", { name: "Quản lý nhóm" }).click();
  await expect(page.getByRole("dialog")).toContainText("Contracts");
  await page.getByRole("button", { name: "Xong" }).click();

  // And back to English.
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("button", { name: "Cài đặt" })
    .click();
  await page.getByRole("group", { name: "Ngôn ngữ" }).getByText("English").click();
  // The reload keeps the user on Settings.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await expect(
    page.getByRole("group", { name: "Language" }).getByRole("radio", { name: "English" }),
  ).toBeChecked();
  await app.close();
});
