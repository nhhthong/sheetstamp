import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";
import { makeDocx, paragraph, run } from "../../src/main/selftest/make-docx";
import { openStorage } from "../../src/main/storage";
import { fileOf } from "./file-of";

const SHOTS = join(import.meta.dirname, "../../test-results/templates-edit");

const launch = (dataDir: string) =>
  electron.launch({
    args: [
      join(import.meta.dirname, "../.."),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, SHEETSTAMP_DATA_DIR: dataDir },
  });

type App = Awaited<ReturnType<typeof launch>>;

async function docx(dir: string, fileName: string, tags: string[]): Promise<string> {
  const body = tags.map((t) => paragraph(run(`${t}: {{${t}}}`))).join("");
  const path = join(dir, fileName);
  writeFileSync(path, await makeDocx({ body }));
  return path;
}

async function stubOpenDialog(app: App, path: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, path);
}

async function shoot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

const openTemplates = (page: Page) =>
  page.getByRole("navigation").getByRole("button", { name: "Mẫu" }).click();

/** A template made through storage, with a mapping profile, before the app starts. */
async function seed(work: string, dataDir: string) {
  const v1 = await docx(work, "v1.docx", ["ho_ten", "ngay_sinh", "ten_con"]);
  const storage = await openStorage(dataDir);
  const groups = await storage.listGroups();
  const made = await storage.createTemplate({
    name: "Hợp đồng lao động",
    kind: "word",
    groupId: groups[0]?.id,
    note: "Bản đầu",
    source: fileOf(v1),
    tags: [
      { name: "ho_ten", label: "Họ và tên" },
      { name: "ngay_sinh", label: "Ngày sinh" },
      { name: "ten_con", label: "Tên con" },
    ],
    filenamePattern: "{{ho_ten}}_{{ten_con}}",
    mapping: {
      ho_ten: { kind: "column", column: "Họ tên" },
      ngay_sinh: { kind: "fixed", text: "01/01/2000" },
      ten_con: { kind: "column", column: "Tên con" },
    },
  });
  return { id: made.id, groupId: groups[0]?.id as string };
}

test("replace the file: flags, kept mapping, unreadable file changes nothing", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-edit-"));
  const dataDir = join(work, "data");
  const { id } = await seed(work, dataDir);
  // v2 renames ten_con to ten_be and adds so_hop_dong.
  const v2 = await docx(work, "v2.docx", ["ho_ten", "ngay_sinh", "ten_be", "so_hop_dong"]);
  const broken = join(work, "hong.docx");
  writeFileSync(broken, "this is not a zip");

  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await openTemplates(page);
  await page.getByRole("button", { name: /^Sửa Hợp đồng/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Tên mẫu")).toHaveValue("Hợp đồng lao động");
  await expect(dialog.getByLabel("Mẫu tên file")).toHaveCount(0);
  await expect(dialog.getByTestId("edit-file-name")).toHaveText("v1.docx");

  // An unreadable file: the reason is shown and nothing is selected.
  await stubOpenDialog(app, broken);
  await dialog.getByRole("button", { name: "Thay file Word…" }).click();
  await expect(dialog.getByTestId("replace-error")).toContainText("không phải tài liệu Word");
  await expect(dialog.getByTestId("replace-summary")).toHaveCount(0);
  await expect(dialog.getByTestId("edit-file-name")).toHaveText("v1.docx");

  // A good file: the summary says what changes before saving.
  await stubOpenDialog(app, v2);
  await dialog.getByRole("button", { name: "Thay file Word…" }).click();
  await expect(dialog.getByTestId("edit-file-name")).toHaveText("v2.docx");
  const summary = dialog.getByTestId("replace-summary");
  await expect(summary).toContainText("Giữ nguyên 2 trường.");
  await expect(summary).toContainText("Trường mới, chưa ghép cột: ten_be, so_hop_dong.");
  await expect(summary).toContainText("Không còn trong file: ten_con.");
  await expect(summary).toContainText("Cách ghép cột của ten_con sẽ bị bỏ");

  const tagRows = dialog.getByTestId("tag-row");
  await expect(tagRows).toHaveCount(5);
  await expect(tagRows.filter({ hasText: "ten_con" })).toContainText("không còn trong file");
  await expect(tagRows.filter({ hasText: "ten_be" })).toContainText("mới");
  await expect(tagRows.filter({ hasText: "so_hop_dong" })).toContainText("mới");
  await expect(tagRows.filter({ hasText: "ho_ten" })).not.toContainText("mới");

  await shoot(page, "replace");

  await dialog.getByLabel("Tên hiển thị của so_hop_dong").fill("Số HĐ");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByText("Đã lưu mẫu.")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("template-row")).toContainText("4 trường");
  await app.close();

  // The stored record: new tags, kept mapping, removed mapping gone, new file copied.
  const storage = await openStorage(dataDir);
  const t = await storage.getTemplate(id);
  expect(t?.tags.map((x) => x.name)).toEqual(["ho_ten", "ngay_sinh", "ten_be", "so_hop_dong"]);
  expect(t?.tags.find((x) => x.name === "so_hop_dong")?.label).toBe("Số HĐ");
  expect(t?.tags.find((x) => x.name === "ho_ten")?.label).toBe("Họ và tên");
  expect(t?.mapping).toEqual({
    ho_ten: { kind: "column", column: "Họ tên" },
    ngay_sinh: { kind: "fixed", text: "01/01/2000" },
  });
  expect(t?.sourceFileName).toBe("v2.docx");
  // The stored pattern is not edited here; the export step checks it against the tags.
  expect(t?.filenamePattern).toBe("{{ho_ten}}_{{ten_con}}");
  expect((await storage.readSource(id)).byteLength).toBeGreaterThan(0);
});

test("a failed replace leaves the stored template untouched", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-edit-"));
  const dataDir = join(work, "data");
  const { id, groupId } = await seed(work, dataDir);
  const broken = join(work, "hong.docx");
  writeFileSync(broken, "this is not a zip");

  const app = await launch(dataDir);
  // Straight through the validated channel: main refuses even if the renderer skips its own check.
  const page = await app.firstWindow();
  const result = await page.evaluate(
    (args) =>
      window.sheetstamp.invoke("templates:update", {
        id: args.id,
        name: "Đổi tên",
        groupId: args.groupId,
        note: "",
        filenamePattern: "{{ho_ten}}",
        labels: {},
        replacePath: args.path,
      }),
    { id, groupId, path: broken },
  );
  expect(result).toMatchObject({ ok: false });
  await app.close();

  const t = await (await openStorage(dataDir)).getTemplate(id);
  expect(t?.name).toBe("Hợp đồng lao động");
  expect(t?.sourceFileName).toBe("v1.docx");
  expect(t?.tags).toHaveLength(3);
});

test("edit name, group, note and labels; they survive a restart", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-edit-"));
  const dataDir = join(work, "data");
  await seed(work, dataDir);

  let app = await launch(dataDir);
  let page = await app.firstWindow();
  await openTemplates(page);
  await page.getByRole("button", { name: /^Sửa Hợp đồng/ }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Ghi chú")).toHaveValue("Bản đầu");
  await expect(dialog.getByLabel("Mẫu tên file")).toHaveCount(0);

  await dialog.getByLabel("Tên mẫu").fill("Hợp đồng thử việc");
  await dialog.getByLabel("Nhóm").selectOption({ label: "+ Thêm nhóm mới…" });
  await dialog.getByLabel("Tên nhóm mới").fill("Tuyển dụng");
  await dialog.getByLabel("Ghi chú").fill("Bản 2026");

  await dialog.getByText("Xem tên hiển thị").click();
  await dialog.getByLabel("Tên hiển thị của ten_con").fill("Tên con nhỏ");
  await shoot(page, "edit");
  await dialog.getByRole("button", { name: "Lưu mẫu" }).click();
  await expect(page.getByText("Đã lưu mẫu.")).toBeVisible();
  await expect(page.getByTestId("template-row")).toContainText("Hợp đồng thử việc");
  await expect(page.getByTestId("template-row")).toContainText("Tuyển dụng");
  await expect(page.getByTestId("template-row")).toContainText("Bản 2026");

  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await openTemplates(page);
  await expect(page.getByTestId("template-row")).toContainText("Hợp đồng thử việc");
  await page.getByRole("button", { name: /^Sửa Hợp đồng/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Tên mẫu")).toHaveValue("Hợp đồng thử việc");
  await expect(dialog.getByLabel("Nhóm").locator("option:checked")).toHaveText("Tuyển dụng");
  await expect(dialog.getByLabel("Ghi chú")).toHaveValue("Bản 2026");
  await dialog.getByText("Xem tên hiển thị").click();
  await expect(dialog.getByLabel("Tên hiển thị của ten_con")).toHaveValue("Tên con nhỏ");
  await expect(dialog.getByLabel("Tên hiển thị của ho_ten")).toHaveValue("Họ và tên");
  await app.close();

  // The mapping profile is untouched by a plain edit.
  const t = (await (await openStorage(dataDir)).listTemplates())[0];
  expect(t?.mapping).toMatchObject({ ho_ten: { kind: "column", column: "Họ tên" } });
});

test("manage groups: rename, unique names, delete moves templates to Chưa phân nhóm", async () => {
  const work = mkdtempSync(join(tmpdir(), "sheetstamp-e2e-edit-"));
  const dataDir = join(work, "data");
  await seed(work, dataDir); // sits in the first default group, "Hợp đồng"

  let app = await launch(dataDir);
  let page = await app.firstWindow();
  // This test asserts where keyboard focus lands, which needs the window to be the active one: a bare X server
  // has no window manager to activate it, so do it explicitly before touching the page.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await openTemplates(page);
  await page.getByRole("button", { name: "Quản lý nhóm" }).click();
  const dialog = page.getByRole("dialog");
  const rows = dialog.getByTestId("group-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "Hợp đồng" })).toContainText("1 mẫu");
  // The footer has one way out ("Xong"), not "Xong" plus a "Hủy" that does the same.
  await expect(dialog.getByRole("button", { name: "Hủy" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Xong" })).toHaveCount(1);
  await shoot(page, "groups");

  // Rename a default group; a name that exists (ignoring case) is refused.
  await dialog.getByRole("button", { name: "Đổi tên nhóm Nghỉ việc" }).click();
  await dialog.getByLabel("Tên mới của nhóm Nghỉ việc").fill("HỢP ĐỒNG");
  await dialog.getByRole("button", { name: "Lưu tên" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Đã có nhóm tên này.");
  await dialog.getByLabel("Tên mới của nhóm Nghỉ việc").fill("Thôi việc");
  await dialog.getByRole("button", { name: "Lưu tên" }).click();
  await expect(rows.filter({ hasText: "Thôi việc" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Nghỉ việc" })).toHaveCount(0);

  // Delete with inline confirmation: keep first, then delete.
  await dialog.getByRole("button", { name: "Xóa nhóm Hợp đồng" }).click();
  await expect(dialog.getByText(/1 mẫu sẽ chuyển sang “Chưa phân nhóm”/)).toBeVisible();
  await shoot(page, "groups-confirm");
  await dialog.getByRole("button", { name: "Giữ lại" }).click();
  await expect(rows).toHaveCount(3);
  await dialog.getByRole("button", { name: "Xóa nhóm Hợp đồng" }).click();
  await dialog.getByRole("button", { name: "Xóa nhóm", exact: true }).click();
  await expect(rows).toHaveCount(2);
  // The row that held focus is gone: focus lands on the first remaining row, not on the page body.
  await expect(dialog.getByRole("button", { name: /^Đổi tên nhóm/ }).first()).toBeFocused();
  // Add a group.
  await dialog.getByLabel("Tên nhóm mới").fill("Nhóm mới");
  await dialog.getByRole("button", { name: "Thêm nhóm" }).click();
  await expect(rows.filter({ hasText: "Nhóm mới" })).toHaveCount(1);
  await dialog.getByTestId("groups-done").click();
  await expect(page.getByTestId("template-row")).toContainText("Chưa phân nhóm");

  // Restart: the rename and the moved template persist, and the template can still be edited.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await openTemplates(page);
  await expect(page.getByTestId("template-row")).toContainText("Chưa phân nhóm");
  await page.getByRole("button", { name: /^Sửa Hợp đồng/ }).click();
  await expect(page.getByRole("dialog").getByLabel("Nhóm").locator("option:checked")).toHaveText(
    "Chưa phân nhóm",
  );
  await app.close();
  const groups = await (await openStorage(dataDir)).listGroups();
  expect(groups.map((g) => g.name)).toEqual(["Thôi việc", "Tài liệu khác", "Nhóm mới"]);
});
