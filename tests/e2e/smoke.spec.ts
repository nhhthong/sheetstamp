import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const launch = () =>
  electron.launch({
    // Root-owned Chromium sandbox helper is unavailable on Linux CI runners and containers.
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
  });

test("the built app opens with its shell, hardened and keyboard friendly", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");

  // Hardening: no Node in the renderer, only the bridge.
  const exposed = await page.evaluate(() => ({
    require: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    bridge: typeof window.sheetstamp?.invoke,
  }));
  expect(exposed).toEqual({ require: "undefined", process: "undefined", bridge: "function" });

  // Three destinations, nothing else, the first one current.
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const items = nav.getByRole("button");
  await expect(items).toHaveText(["Tạo file", "Mẫu", "Cài đặt"]);
  await expect(items.first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tạo file hàng loạt");

  // Keyboard: tab to the second item, press Enter.
  await items.first().focus();
  await page.keyboard.press("Tab");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mẫu");
  await expect(page.getByText("Tạo một lần, dùng lại cho mọi lần xuất.")).toBeVisible();
  await items.nth(2).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cài đặt");

  // The IPC layer answers, and refuses an unknown channel.
  const info = await page.evaluate(() => window.sheetstamp.invoke("app:info"));
  expect(info).toMatchObject({ name: expect.any(String), version: "0.1.0" });
  const refused = await page.evaluate(() =>
    window.sheetstamp.invoke("fs:read", "/etc/passwd").then(
      () => "ok",
      (e: Error) => e.message,
    ),
  );
  expect(refused).toContain("Unknown channel");
  const invalid = await page.evaluate(() =>
    window.sheetstamp.invoke("data:set-sheet", { sheet: 5 }).then(
      () => "ok",
      (e: Error) => e.message,
    ),
  );
  expect(invalid).toContain("sheet must be a string");

  await app.close();
});

test("below about 820 px the sidebar becomes a top bar", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1100, 760));
  await expect.poll(async () => (await nav.boundingBox())?.height).toBeGreaterThan(400);

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(780, 760));
  await expect.poll(async () => (await nav.boundingBox())?.height).toBeLessThan(120);
  const box = await nav.boundingBox();
  expect(box?.width).toBeGreaterThan(700);

  await app.close();
});
