import { mkdirSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { openStorage } from "../../src/main/storage";
import {
  answerDialog,
  HEADER,
  launch,
  PEOPLE,
  seedTemplate,
  shoot,
  step,
  toStepExport,
  workFolder,
  writeCsv1258,
  writeTemplate,
} from "./export-support";

let work: string;
let dataDir: string;
let out: string;
let csv: string;
let big: string;
let docx: string;
let templateId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  work = workFolder("home-export");
  dataDir = join(work, "data");
  out = join(work, "out");
  mkdirSync(out, { recursive: true });
  csv = join(work, "nhan-vien.csv");
  writeCsv1258(csv, [HEADER, ...PEOPLE]);
  big = join(work, "lon.csv");
  writeCsv1258(big, [
    HEADER,
    ...Array.from({ length: 4000 }, (_, i) => [`Người số ${i + 1}`, "Nhân viên", `Phòng ${i % 7}`]),
  ]);
  docx = join(work, "mau.docx");
  await writeTemplate(docx);
  templateId = await seedTemplate(dataDir, docx);
});

test.afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const example = (page: Page) => page.getByTestId("file-example");
const editorOf = (page: Page) => page.getByTestId("filename-editor");
const exportButton = (page: Page, n = 12) => page.getByRole("button", { name: `Xuất ${n} file` });

/** Answer every native dialog and remember the options it was opened with. */
const recordPicker = (app: ElectronApplication, path: string) =>
  app.evaluate(({ dialog }, chosen) => {
    const calls: unknown[] = [];
    (globalThis as unknown as { __picker: unknown[] }).__picker = calls;
    dialog.showOpenDialog = (async (...args: unknown[]) => {
      calls.push(args.length > 1 ? args[1] : args[0]);
      return { canceled: false, filePaths: [chosen] };
    }) as never;
  }, path);
const pickerCalls = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { __picker: unknown[] }).__picker);

test("T-22: chips, the live example, the diacritics option, saving into the template, and the folder", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv);

  // Summary lines: the default pattern is the first field (no field "ten"); the primary button counts the rows.
  await expect(example(page)).toHaveText("Nguyễn Văn An.docx");
  await expect(editorOf(page)).toBeHidden();
  await expect(exportButton(page)).toBeEnabled();

  await page.getByRole("button", { name: "Đổi tên file" }).click();
  const editor = editorOf(page);
  const checkbox = editor.getByRole("checkbox", { name: "Bỏ dấu tiếng Việt trong tên file" });
  await expect(checkbox).not.toBeChecked();
  // One "+ field" button per field of the template.
  expect(await editor.getByRole("button", { name: /^Thêm trường / }).allTextContents()).toEqual([
    "+ Họ tên",
    "+ Chức vụ",
    "+ Phòng ban",
    "+ Ngày ký",
  ]);

  // Chips are a view of the pattern: field chips blue (data-kind), fixed text neutral, each removable.
  await editor.getByLabel("Thêm chữ").fill("_Thử việc");
  await page.keyboard.press("Enter");
  await expect(editor.getByTestId("pattern-chip")).toHaveCount(2);
  await expect(example(page)).toHaveText("Nguyễn Văn An_Thử việc.docx");
  await checkbox.check();
  await expect(example(page)).toHaveText("Nguyen Van An_Thu viec.docx");
  await editor.getByRole("button", { name: "Bỏ _Thử việc" }).click();
  await expect(example(page)).toHaveText("Nguyen Van An.docx");

  // Problems from the rules show inline and block the primary button.
  await editor.getByLabel("Thêm chữ").fill("a/b");
  await editor.getByRole("button", { name: "Thêm", exact: true }).click();
  const problems = page.getByTestId("pattern-problems");
  await expect(problems).toContainText("có dấu /, \\ hoặc ..");
  await expect(exportButton(page)).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Xong" })).toBeDisabled();
  await expect(page.getByText("Sửa tên file trước khi xuất.")).toBeVisible();
  await shoot(page, "home-export", "problem");
  await editor.getByRole("button", { name: "Bỏ a/b" }).click();
  await expect(problems).toBeHidden();

  for (const bad of ["..", "x\\y"]) {
    await editor.getByLabel("Thêm chữ").fill(bad);
    await editor.getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(problems).toBeVisible();
    await expect(exportButton(page)).toBeDisabled();
    await editor.getByRole("button", { name: `Bỏ ${bad}` }).click();
    await expect(problems).toBeHidden();
  }

  // An empty pattern is a problem too.
  await editor.getByRole("button", { name: "Bỏ Họ tên" }).click();
  await expect(problems).toContainText("đang trống");
  await expect(example(page)).toHaveText("(chưa có tên)");
  await expect(exportButton(page)).toBeDisabled();

  // Build the final pattern and save it with the template.
  await editor.getByRole("button", { name: "Thêm trường Chức vụ" }).click();
  await editor.getByLabel("Thêm chữ").fill("_");
  await editor.getByRole("button", { name: "Thêm", exact: true }).click();
  await editor.getByRole("button", { name: "Thêm trường Họ tên" }).click();
  await expect(example(page)).toHaveText("Ke toan truong_Nguyen Van An.docx");
  await editor.getByRole("button", { name: "Lưu mẫu tên này vào mẫu" }).click();
  await expect(editor.getByText("Đã lưu mẫu tên file vào mẫu.")).toBeVisible();
  await shoot(page, "home-export", "editor");
  await editor.getByRole("button", { name: "Xong" }).click();
  await expect(editor).toBeHidden();

  // The folder: the native picker opens at the last folder; the choice is remembered.
  await recordPicker(app, out);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(out);
  expect(await pickerCalls(app)).toMatchObject([
    { properties: ["openDirectory", "createDirectory"] },
  ]);
  await app.close();

  const stored = await (await openStorage(dataDir)).getTemplate(templateId);
  expect(stored?.filenamePattern).toBe("{{chuc_vu}}_{{ho_ten}}");
  const choices = await (await openStorage(dataDir)).getChoices();
  expect(choices).toMatchObject({ removeDiacritics: true, lastOutputFolder: out });
});

test("T-22: after a restart the folder, the option and the saved pattern are back, and the picker opens at the folder", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv);
  await expect(page.getByTestId("export-folder")).toHaveText(out);
  await expect(example(page)).toHaveText("Ke toan truong_Nguyen Van An.docx");
  await page.getByRole("button", { name: "Đổi tên file" }).click();
  await expect(
    editorOf(page).getByRole("checkbox", { name: "Bỏ dấu tiếng Việt trong tên file" }),
  ).toBeChecked();

  await recordPicker(app, out);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  expect(await pickerCalls(app)).toMatchObject([{ defaultPath: out }]);
  await app.close();
});

test("T-22: a stored pattern with an unknown field opens the editor with the problem and blocks the export", async () => {
  const storage = await openStorage(dataDir);
  await storage.updateTemplate(templateId, { filenamePattern: "{{khong_co}}_x" });
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv);
  await expect(editorOf(page)).toBeVisible();
  await expect(page.getByTestId("pattern-problems")).toContainText(
    "Trường “khong_co” không có trong mẫu này",
  );
  await expect(exportButton(page)).toBeDisabled();
  // Fix it: remove the bad chip and add a field.
  await editorOf(page).getByRole("button", { name: "Bỏ khong_co" }).click();
  await editorOf(page).getByRole("button", { name: "Thêm trường Họ tên" }).click();
  await expect(exportButton(page)).toBeEnabled();
  await app.close();
  await storage.updateTemplate(templateId, { filenamePattern: "{{ho_ten}}" });
});

const stray = async (folder: string) =>
  (await readdir(folder)).filter((name) => name.endsWith(".tmp") || name.startsWith(".sheetstamp"));

test("T-23: closing the window during an export asks first; closing at any other time does not", async () => {
  const closeOut = join(work, "out-close");
  mkdirSync(closeOut, { recursive: true });
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, big);
  await answerDialog(app, closeOut);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await expect(page.getByTestId("export-folder")).toHaveText(closeOut);

  // Not exporting: the window closes without any question (the box is rigged to fail the test if it appears).
  await app.evaluate(({ dialog }) => {
    const asked: unknown[] = [];
    (globalThis as unknown as { __asked: unknown[] }).__asked = asked;
    dialog.showMessageBox = (async (...args: unknown[]) => {
      asked.push(args);
      return { response: 0, checkboxChecked: false };
    }) as never;
  });
  const asked = () =>
    app.evaluate(() => (globalThis as unknown as { __asked: unknown[] }).__asked.length);

  await exportButton(page, 4000).click();
  await expect(page.getByTestId("export-progress-text")).toHaveText(
    /^Đang tạo file… [1-9]\d*\/4000$/,
  );

  // "Ở lại": the box is shown once, the export goes on.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await expect.poll(asked).toBe(1);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await expect(page.getByTestId("export-running")).toBeVisible();
  const before = await page.getByTestId("export-progress-text").textContent();
  await expect(page.getByTestId("export-progress-text")).not.toHaveText(before ?? "");

  // "Hủy và đóng": the export is cancelled, nothing is left in the folder, and the app closes.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as never;
  });
  const closed = app.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await closed;
  expect(await readdir(closeOut)).toEqual([]);
});

test("T-23: with no export running the window closes without asking", async () => {
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, csv);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => {
      throw new Error("The close box must not appear when nothing is exporting");
    }) as never;
  });
  const closed = app.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await closed;
});

test("T-23: while exporting the step stays active and a second start is refused", async () => {
  const runOut = join(work, "out-run");
  mkdirSync(runOut, { recursive: true });
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await toStepExport(app, page, big);
  await answerDialog(app, runOut);
  await page.getByRole("button", { name: "Đổi thư mục lưu" }).click();
  await exportButton(page, 4000).click();
  await expect(page.getByTestId("export-running")).toBeVisible();
  // The primary button is gone while exporting; every "Đổi" of the earlier steps bounces back.
  await expect(exportButton(page, 4000)).toHaveCount(0);
  for (const name of ["Dữ liệu", "Mẫu", "Ghép cột"]) {
    await page.getByRole("button", { name: `Đổi: ${name}` }).click();
    await expect(step(page, "export")).toHaveAttribute("data-status", "active");
  }
  // Main refuses a second start even if the page asks for one.
  const second = await page.evaluate(
    ([id]) =>
      (
        window as unknown as { sheetstamp: { invoke: (c: string, r: unknown) => Promise<unknown> } }
      ).sheetstamp.invoke("export:start", {
        templateId: id,
        pattern: "{{ho_ten}}",
        removeDiacritics: false,
      }),
    [templateId],
  );
  expect(second).toEqual({ ok: false, code: "busy" });
  await expect(page.getByTestId("done-title")).toHaveText("Đã tạo 4000 file", { timeout: 60_000 });
  expect(await stray(runOut)).toEqual([]);
  await app.close();
});
