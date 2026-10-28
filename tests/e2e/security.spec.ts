import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type ElectronApplication, _electron as electron, expect, test } from "@playwright/test";

const launch = () =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
  });

/** Another local page, as an attacker (or a file dropped on the window) would bring in. */
async function foreignPage(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sheetstamp-foreign-"));
  const file = join(dir, "other.html");
  await writeFile(file, "<!doctype html><title>foreign</title><p>foreign page</p>");
  return file;
}

const invokeInfo = () =>
  window.sheetstamp.invoke("app:info").then(
    () => "ok",
    (e: Error) => e.message,
  );

const openWindows = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

test("the window refuses to navigate to another file or to the web, and opens no new window", async () => {
  const foreign = await foreignPage();
  const app = await launch();
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");
  const appUrl = page.url();

  for (const target of [pathToFileURL(foreign).href, "https://example.com/"]) {
    await page.evaluate((url) => {
      window.location.href = url;
    }, target);
    await page.waitForTimeout(700);
    expect(page.url()).toBe(appUrl);
    expect(await page.evaluate(invokeInfo)).toBe("ok");
  }

  // window.open gives nothing and no window appears.
  const opened = await page.evaluate(() => window.open("https://example.com/") === null);
  expect(opened).toBe(true);
  await page.waitForTimeout(300);
  expect(await openWindows(app)).toBe(1);

  await app.close();
});

test("a foreign page that gets loaded anyway cannot use the bridge", async () => {
  const foreign = await foreignPage();
  const app = await launch();
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");
  expect(await page.evaluate(invokeInfo)).toBe("ok");

  // Main loads it directly, which skips the navigation events: the IPC origin check is the second wall.
  await app.evaluate(({ BrowserWindow }, url) => {
    void BrowserWindow.getAllWindows()[0]?.webContents.loadURL(url);
  }, pathToFileURL(foreign).href);
  await expect(page.getByText("foreign page")).toBeVisible();
  const state = await page.evaluate(async () => ({
    bridge: typeof window.sheetstamp?.invoke,
    result: await window.sheetstamp.invoke("app:info").then(
      () => "ok",
      (e: Error) => e.message,
    ),
  }));
  expect(state.result).toContain("Untrusted sender");
  expect(state.result).not.toBe("ok");

  // The app page itself with a hash is still the app.
  await app.evaluate(
    ({ BrowserWindow }, url) => {
      void BrowserWindow.getAllWindows()[0]?.webContents.loadURL(`${url}#x`);
    },
    pathToFileURL(join(import.meta.dirname, "../../out/renderer/index.html")).href,
  );
  await expect(page).toHaveTitle("Sheetstamp");
  expect(await page.evaluate(invokeInfo)).toBe("ok");

  await app.close();
});

test("a file dropped outside a drop zone does not navigate the window", async () => {
  const foreign = await foreignPage();
  const app = await launch();
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");
  const appUrl = page.url();

  // Record what the page did with each event once all of its own listeners have run.
  await page.evaluate(() => {
    const seen: Record<string, boolean[]> = { dragover: [], drop: [] };
    (window as unknown as { seen: typeof seen }).seen = seen;
    for (const type of ["dragover", "drop"])
      window.addEventListener(type, (e) => seen[type]?.push(e.defaultPrevented));
  });
  const cdp = await page.context().newCDPSession(page);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const box = await nav.boundingBox();
  if (!box) throw new Error("navigation not visible");
  // Bottom of the sidebar: no drop zone there.
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 8;
  const data = { items: [], files: [foreign], dragOperationsMask: 1 };
  await cdp.send("Input.dispatchDragEvent", { type: "dragEnter", x, y, data });
  await cdp.send("Input.dispatchDragEvent", { type: "dragOver", x, y, data });
  await cdp.send("Input.dispatchDragEvent", { type: "drop", x, y, data });
  await page.waitForTimeout(700);

  const seen = await page.evaluate(
    () => (window as unknown as { seen: Record<string, boolean[]> }).seen,
  );
  // Chromium only sends `drop` after a cancelled `dragover`; outside a zone the page cancels it with
  // dropEffect "none", so the browser's own default (open the file) never runs.
  expect(seen.dragover?.length).toBeGreaterThan(0);
  expect(seen.dragover?.every(Boolean)).toBe(true);
  expect(seen.drop?.every(Boolean)).toBe(true);
  expect(page.url()).toBe(appUrl);
  await expect(page.getByText("foreign page")).toHaveCount(0);
  expect(await page.evaluate(invokeInfo)).toBe("ok");

  await app.close();
});
