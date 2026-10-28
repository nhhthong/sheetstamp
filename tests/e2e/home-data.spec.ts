import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";

/** The distinctive name used to prove no copy is left on disk. */
const MARKER = "Zyxwvu Tống Quỳnh";

const MAKE_DATA = join(import.meta.dirname, "../fixtures/data/make-data.ts");

/**
 * Write a fixture with the helpers of tests/fixtures/data/make-data.ts. They run in a plain Node process:
 * the Playwright test loader cannot load exceljs ("module not been linked").
 */
function generate(kind: "csv-1258" | "xlsx" | "fake-xls", path: string, payload: unknown = null) {
  const script = `
    const { writeFileSync } = await import("node:fs");
    const m = await import(${JSON.stringify(pathToFileURL(MAKE_DATA).href)});
    const [kind, path, json] = process.argv.slice(1);
    const payload = JSON.parse(json);
    const bytes =
      kind === "csv-1258" ? m.encodeWindows1258(m.toCsv(payload))
      : kind === "xlsx" ? await m.makeXlsx(payload)
      : m.fakeXls();
    writeFileSync(path, bytes);
  `;
  execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script, kind, path, JSON.stringify(payload)],
    { stdio: "pipe" },
  );
}

const HEADER = ["Họ tên", "Email", "Phòng ban"];
const PEOPLE = [
  ["Nguyễn Thị Hương", "", "Kế toán"],
  ["Trần Văn Đức", "", "Nhân sự"],
  ["Phạm Thị Ngọc Ánh", "a@b.vn", "Kinh doanh"],
  /** A name that appears in no other file, so a scan of the disk can find any copy of the data. */
  [MARKER, "m@b.vn", "Kho"],
];

let work: string;
let userData: string;
let files: { csv: string; xlsx: string; xls: string; renamed: string };
let tmpBefore: string[];

test.beforeAll(async () => {
  tmpBefore = await readdir(tmpdir());
  work = await mkdtemp(join(tmpdir(), "sheetstamp-e2e-fixtures-"));
  userData = join(await mkdtemp(join(tmpdir(), "sheetstamp-e2e-userdata-")), "profile");
  await mkdir(userData, { recursive: true });
  files = {
    csv: join(work, "nhan-vien.csv"),
    xlsx: join(work, "luong.xlsx"),
    xls: join(work, "cu.xls"),
    renamed: join(work, "doi-ten.xlsx"),
  };
  generate("csv-1258", files.csv, [HEADER, ...PEOPLE]);
  generate("xlsx", files.xlsx, [
    {
      name: "Tháng 1",
      rows: [
        ["Họ tên", "CCCD"],
        ["An", 1234567890],
        ["Bình", 79012345678],
      ],
    },
    {
      name: "Tháng 2",
      rows: [
        ["Họ tên", "Lương"],
        ["Chi", "7"],
      ],
    },
  ]);
  generate("fake-xls", files.xls);
  generate("fake-xls", files.renamed);
});

test.afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

const launch = () =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      `--user-data-dir=${userData}`,
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
  });

/** The native dialog cannot be driven, so the test answers it with a path. */
const answerDialog = (app: ElectronApplication, path: string) =>
  app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [chosen],
    })) as typeof dialog.showOpenDialog;
  }, path);

/** A real file drop: Chromium turns it into a File whose path only the preload bridge can read. */
async function dropFile(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  const target = page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ });
  const box = await target.boundingBox();
  if (!box) throw new Error("drop zone not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const data = { items: [], files: [path], dragOperationsMask: 1 };
  await cdp.send("Input.dispatchDragEvent", { type: "dragEnter", x, y, data });
  await cdp.send("Input.dispatchDragEvent", { type: "dragOver", x, y, data });
  await cdp.send("Input.dispatchDragEvent", { type: "drop", x, y, data });
}

const step = (page: Page, id: string) => page.locator(`li[data-step="${id}"]`);

async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(path)));
    else if (
      entry.isFile() ||
      (await stat(path)
        .then((s) => s.isFile())
        .catch(() => false))
    )
      out.push(path);
  }
  return out;
}

test("step 1 reads a dropped Windows-1258 CSV and lets the user fix how it was read", async () => {
  const app = await launch();
  const page = await app.firstWindow();

  // Locked steps are greyed and cannot be opened; only step 1 is active.
  await expect(step(page, "data")).toHaveAttribute("data-status", "active");
  for (const id of ["template", "mapping", "export"])
    await expect(step(page, id)).toHaveAttribute("data-status", "locked");
  await expect(step(page, "template").getByRole("button")).toHaveCount(0);

  await dropFile(page, files.csv);
  await expect(page.getByTestId("file-name")).toHaveText("nhan-vien.csv");
  await expect(page.getByTestId("file-counts")).toHaveText("4 dòng, 3 cột");
  const preview = page.getByTestId("preview");
  await expect(preview.locator("tbody tr")).toHaveCount(4);
  await expect(preview).toContainText("Nguyễn Thị Hương");
  await expect(preview).toContainText(MARKER);

  // Empty cells are reported per column.
  await expect(page.getByText("2 ô trống ở cột Email")).toBeVisible();

  // The primary button is bottom-left of the step: left edge flush with the table, below it.
  const primary = page.getByRole("button", { name: "Tiếp tục" });
  const tableBox = await preview.boundingBox();
  const buttonBox = await primary.boundingBox();
  expect(Math.abs((buttonBox?.x ?? 0) - (tableBox?.x ?? 99))).toBeLessThan(2);
  expect(buttonBox?.y ?? 0).toBeGreaterThan((tableBox?.y ?? 0) + (tableBox?.height ?? 0));

  // Switching the encoding refreshes the preview: UTF-8 shows the wrong text, Windows-1258 the right one.
  await page.getByRole("button", { name: "Đổi bảng mã" }).click();
  const select = page.getByLabel("Bảng mã");
  await expect(select).toHaveValue("windows-1258");
  await select.selectOption("utf-8");
  await expect(preview).not.toContainText("Nguyễn Thị Hương");
  await select.selectOption("windows-1258");
  await expect(preview).toContainText("Nguyễn Thị Hương");

  // Done: collapsed to one line plus "Đổi", later steps keep their lock until the next one is open.
  await primary.click();
  await expect(step(page, "data")).toHaveAttribute("data-status", "done");
  await expect(step(page, "data")).toContainText("nhan-vien.csv, 4 dòng, 3 cột");
  await expect(step(page, "template")).toHaveAttribute("data-status", "active");
  await expect(step(page, "mapping")).toHaveAttribute("data-status", "locked");
  await step(page, "data").getByRole("button", { name: /^Đổi/ }).click();
  await expect(step(page, "data")).toHaveAttribute("data-status", "active");
  await expect(page.getByTestId("file-name")).toHaveText("nhan-vien.csv");

  await app.close();
});

test("an .xlsx with several sheets and a numeric ID column", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await answerDialog(app, files.xlsx);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();

  await expect(page.getByTestId("file-name")).toHaveText("luong.xlsx");
  const sheet = page.getByLabel("Bảng tính");
  await expect(sheet.locator("option")).toHaveText(["Tháng 1", "Tháng 2"]);
  // CSV encoding is not offered for a workbook.
  await expect(page.getByRole("button", { name: "Đổi bảng mã" })).toHaveCount(0);

  const preview = page.getByTestId("preview");
  await expect(page.getByText("Cột CCCD đang là số nên có thể mất số 0 ở đầu.")).toBeVisible();
  await expect(preview).toContainText("1234567890");
  await page.getByLabel("Số chữ số của cột CCCD").fill("12");
  await page.getByRole("button", { name: "Thêm số 0 ở đầu" }).click();
  await expect(preview).toContainText("001234567890");
  await expect(preview).toContainText("079012345678");
  await expect(page.getByText("Đã thêm số 0 ở đầu cột CCCD.")).toBeVisible();
  await expect(page.getByText("đang là số nên có thể mất số 0")).toHaveCount(0);

  await sheet.selectOption("Tháng 2");
  await expect(preview).toContainText("Lương");
  await expect(page.getByTestId("file-counts")).toHaveText("1 dòng, 2 cột");

  await app.close();
});

test("a .xls, also a renamed one, shows the re-save message inline and keeps the page usable", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  const message =
    "Không đọc được file .xls. Mở file trong Excel, chọn Lưu thành, rồi lưu lại dạng .xlsx hoặc .csv.";

  await dropFile(page, files.xls);
  await expect(step(page, "data").getByText(message)).toBeVisible();
  await expect(page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ })).toBeVisible();

  await answerDialog(app, files.renamed);
  await page.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }).click();
  await expect(step(page, "data").getByText(message)).toBeVisible();
  await expect(page.getByTestId("preview")).toHaveCount(0);

  await app.close();
});

test("Reload reads a changed file; nothing is left on disk or after a restart", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await dropFile(page, files.csv);
  await expect(page.getByTestId("file-counts")).toHaveText("4 dòng, 3 cột");

  // The file changes on disk: the page says so, and Reload picks it up with the encoding kept.
  generate("csv-1258", files.csv, [HEADER, ...PEOPLE, ["Lê Văn Thêm", "t@y.vn", "Kho"]]);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.focus());
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("File đã thay đổi trên ổ đĩa")).toBeVisible();
  await page.getByRole("button", { name: "Đọc lại" }).click();
  await expect(page.getByTestId("file-counts")).toHaveText("5 dòng, 3 cột");
  await expect(page.getByText("File đã thay đổi trên ổ đĩa")).toHaveCount(0);
  await expect(page.getByTestId("preview")).toContainText("Nguyễn Thị Hương");
  await app.close();

  // A restart: the page is empty again.
  const again = await launch();
  const fresh = await again.firstWindow();
  await expect(
    fresh.getByRole("button", { name: /Thả file Excel hoặc CSV vào đây/ }),
  ).toBeVisible();
  await expect(fresh.getByTestId("preview")).toHaveCount(0);
  await again.close();

  // No copy on disk: neither the app's data folder nor anything new in the temp folder holds the data.
  const needles = [MARKER, "Nguyễn Thị Hương", "1234567890"].flatMap((text) => [
    Buffer.from(text, "utf8"),
    Buffer.from(text, "utf16le"),
  ]);
  const newTemp = (await readdir(tmpdir())).filter(
    (name) => !tmpBefore.includes(name) && !work.endsWith(name) && !userData.includes(name),
  );
  const suspects = [
    ...(await filesUnder(userData)),
    ...(await Promise.all(newTemp.map((name) => filesUnder(join(tmpdir(), name))))).flat(),
  ];
  expect(suspects.length).toBeGreaterThan(0); // the scan did look at something (Chromium's own files)
  for (const path of suspects) {
    const bytes = await readFile(path);
    for (const needle of needles) expect(bytes.includes(needle), path).toBe(false);
  }
  expect(suspects.some((p) => /\.(csv|xlsx)$/i.test(p))).toBe(false);
});
