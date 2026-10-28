import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("the built app opens a window with its name and version", async () => {
  const app = await electron.launch({
    // Root-owned Chromium sandbox helper is unavailable on Linux CI runners and containers.
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
  });
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");
  await expect(page.getByTestId("version")).toContainText("Phiên bản 0.1.0");

  const exposed = await page.evaluate(() => ({
    require: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    api: typeof window.sheetstamp?.ping,
  }));
  expect(exposed).toEqual({ require: "undefined", process: "undefined", api: "function" });

  await app.close();
});
