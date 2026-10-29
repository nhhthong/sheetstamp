// The app needs no network (R11.1): with every host name refused and a dead proxy, it starts and makes an image ZIP,
// and no http(s) or ws(s) request leaves the window. Requests made by Node code in main would not show here; the app
// has none (no dependency that does networking), and the packaged self-test runs without one.
import { mkdirSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { openStorage } from "../../src/main/storage";
import { answerDialog, toStepExport, workFolder, writeCsv1258 } from "./export-support";
import { fileOf } from "./file-of";

const BACKGROUND = join(import.meta.dirname, "../fixtures/image/golden/four-styles.png");

let work: string;

test.beforeAll(() => {
  work = workFolder("offline");
});

test.afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

test("with the network blocked the app starts, exports and attempts no request", async () => {
  const dataDir = join(work, "data");
  const out = join(work, "out");
  mkdirSync(out, { recursive: true });
  const csv = join(work, "a.csv");
  writeCsv1258(csv, [["Họ tên"], ["Nguyễn Văn An"], ["Trần Thị Bình"]]);
  await (await openStorage(dataDir)).createTemplate({
    name: "Giấy khen",
    kind: "image",
    imageLayout: {
      version: 1,
      boxes: [
        {
          id: "a",
          field: "ho_ten",
          x: 10,
          y: 10,
          width: 300,
          fontSize: 24,
          fontFamily: "Sheetstamp Test",
          style: "normal",
          color: "#c00000",
          align: "left",
          maxLines: 1,
          overflow: "error",
        },
      ],
    },
    tags: [{ name: "ho_ten", label: "Họ tên" }],
    source: fileOf(BACKGROUND),
  });

  const app = await electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      // Every name fails to resolve and the only proxy is a closed port.
      "--host-resolver-rules=MAP * ~NOTFOUND",
      "--proxy-server=http://127.0.0.1:9",
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });
  // Count what the window tries to fetch from the network from now on (the app is loaded from files).
  await app.evaluate(({ session }) => {
    const seen: string[] = [];
    (globalThis as unknown as { __net: string[] }).__net = seen;
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, done) => {
        seen.push(details.url);
        done({ cancel: true });
      },
    );
  });
  // Control: the counter does see a request (made from main, which the page's CSP would not stop).
  await app.evaluate(({ net }) => net.fetch("https://example.invalid/").catch(() => undefined));
  expect(await app.evaluate(() => (globalThis as unknown as { __net: string[] }).__net)).toEqual([
    "https://example.invalid/",
  ]);
  await app.evaluate(() => ((globalThis as unknown as { __net: string[] }).__net.length = 0));
  const page = await app.firstWindow();
  await expect(page).toHaveTitle("Sheetstamp");
  await toStepExport(app, page, csv, "Giấy khen");
  await answerDialog(app, out);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await page.getByRole("button", { name: "Xuất 2 file" }).click();
  await expect(page.getByTestId("done-title")).toHaveText("Đã tạo 2 file", { timeout: 60_000 });
  expect((await readdir(out)).filter((n) => n.endsWith(".zip"))).toHaveLength(1);
  expect(await app.evaluate(() => (globalThis as unknown as { __net: string[] }).__net)).toEqual(
    [],
  );
  await app.close();
});
