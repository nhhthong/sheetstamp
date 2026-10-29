// T-35: Cài đặt > Giới thiệu shows the version, licence, notices and Electron date; "Kiểm tra bản mới" only asks main
// to open the fixed download page (shell.openExternal is replaced here, so no browser opens).
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const root = join(import.meta.dirname, "../..");
const read = (name: string) => readFileSync(join(root, name), "utf8");
const URL_OF_DOWNLOAD_PAGE = "https://nhhthong.github.io/sheetstamp";

test("Giới thiệu shows the facts and Kiểm tra bản mới opens only the download page", async () => {
  const app = await electron.launch({
    args: [root, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: {
      ...process.env,
      SHEETSTAMP_DATA_DIR: mkdtempSync(join(tmpdir(), "sheetstamp-e2e-about-")),
    },
  });
  // Record the calls instead of opening a browser.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as Record<string, unknown>).__opened = opened;
    shell.openExternal = async (url: string) => {
      opened.push(url);
    };
  });
  const opened = () =>
    app.evaluate(() => (globalThis as Record<string, unknown>).__opened as string[]);

  const page = await app.firstWindow();
  await page.getByRole("navigation").getByRole("button", { name: "Cài đặt" }).click();
  const about = page.getByRole("region", { name: "Giới thiệu" });

  const { version } = JSON.parse(read("package.json")) as { version: string };
  await expect(about.getByText(`Sheetstamp phiên bản ${version}`)).toBeVisible();
  await expect(about.getByText("Giấy phép MIT. Chạy hoàn toàn trên máy này")).toBeVisible();
  await expect(about.getByRole("region", { name: "Nội dung giấy phép MIT" })).toContainText(
    read("LICENSE").trim(),
  );
  const notices = about.getByRole("region", { name: "Thông báo về phần mềm bên thứ ba" });
  await expect(notices).toContainText("Third-party notices");
  await expect(notices).toContainText("@base-ui/react");
  await expect(about.getByText("hỗ trợ bảo mật đến 27/04/2027")).toBeVisible();
  await expect(about.getByText(URL_OF_DOWNLOAD_PAGE)).toBeVisible();

  expect(await opened()).toEqual([]);
  await about.getByRole("button", { name: "Kiểm tra bản mới" }).click();
  await expect.poll(opened).toEqual([URL_OF_DOWNLOAD_PAGE]);

  // The command takes no address: any argument is refused and nothing more is opened.
  for (const bad of ["https://example.com", URL_OF_DOWNLOAD_PAGE, { url: "https://example.com" }]) {
    const refused = await page.evaluate(
      (arg) =>
        window.sheetstamp.invoke("app:open-download-page", arg).then(
          () => false,
          () => true,
        ),
      bad,
    );
    expect(refused).toBe(true);
  }
  // Names outside the registry never reach main.
  expect(
    await page.evaluate(() =>
      window.sheetstamp.invoke("shell:open-external", "https://example.com").then(
        () => false,
        () => true,
      ),
    ),
  ).toBe(true);
  expect(await opened()).toEqual([URL_OF_DOWNLOAD_PAGE]);

  // window.open and navigation stay blocked.
  const popup = await page.evaluate(() => window.open("https://example.com") === null);
  expect(popup).toBe(true);
  expect(app.windows()).toHaveLength(1);
  await app.close();
});
