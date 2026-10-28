import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { _electron as electron, expect, type Page, test } from "@playwright/test";
import JSZip from "jszip";
import { makeDocx, paragraph, run } from "../../src/main/selftest/make-docx";

const root = join(import.meta.dirname, "../..");
const sample = readFileSync(join(root, "tests/fixtures/word/preview-contract.docx"));

const launch = () =>
  electron.launch({
    args: [root, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
  });

async function open(page: Page) {
  await page.goto(pathToFileURL(join(root, "out/renderer/preview/demo.html")).href);
  await page.waitForFunction(() => window.previewDemo !== undefined);
}

/** Show a document and wait until the preview has drawn it; returns the milliseconds it took. */
async function show(
  page: Page,
  docx: Uint8Array,
  values: Record<string, string>,
  unmapped: string[],
  marker: string,
): Promise<number> {
  return page.evaluate(
    async ({ b64, values, unmapped, marker }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const t0 = performance.now();
      window.previewDemo?.show(bytes, values, unmapped);
      while (!document.body.innerText.includes(marker)) {
        if (performance.now() - t0 > 10_000) throw new Error(`never showed ${marker}`);
        await new Promise((r) => setTimeout(r, 5));
      }
      return Math.round(performance.now() - t0);
    },
    { b64: Buffer.from(docx).toString("base64"), values, unmapped, marker },
  );
}

const row1 = {
  so_hop_dong: "HD-001/2026",
  ho_ten: "Nguyễn Thị Hương",
  ngay_sinh: "01/02/1990",
  cccd: "001234567890",
  dia_chi: "12 Lê Lợi, Hà Nội",
  ghi_chu: "",
  chuc_vu: "Kế toán",
  luong: "10.000.000",
  phong_ban: "Tài chính",
};
const row2 = {
  ...row1,
  so_hop_dong: "HD-002/2026",
  ho_ten: "Trần Văn Bình",
  ghi_chu: "Thử việc 2 tháng",
};

test("a filled contract shows as pages with highlights, (trống) in red and (thiếu)", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await open(page);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // Row 1: ghi_chu is empty and ngay_sinh has no column.
  await show(page, sample, row1, ["ngay_sinh"], "Nguyễn Thị Hương");

  // Pages: two A4 sections, a header, a footer, a bordered table.
  const pages = page.locator("section.docx");
  await expect(pages).toHaveCount(2);
  await expect(pages.first().locator("header")).toContainText("Hợp đồng HD-001/2026");
  await expect(pages.first().locator("footer")).toContainText("Nguyễn Thị Hương - trang");
  const cell = pages.first().locator("table td").first();
  expect(await cell.evaluate((el) => getComputedStyle(el).borderTopStyle)).not.toBe("none");
  expect(
    await cell.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopWidth)),
  ).toBeGreaterThan(0);

  // Highlights.
  const filled = page.locator(".ss-filled");
  await expect(filled.filter({ hasText: "Nguyễn Thị Hương" }).first()).toBeVisible();
  expect(await filled.first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    "rgb(255, 224, 138)",
  );
  const empty = page.locator(".ss-empty");
  await expect(empty).toHaveCount(1);
  await expect(empty).toHaveText("(trống)");
  expect(await empty.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(192, 0, 0)");
  const missing = page.locator(".ss-missing");
  await expect(missing).toHaveText("(thiếu)");
  await expect(missing).toHaveAttribute("title", /ngay_sinh/);
  // No marker character and no raw tag is left on screen.
  const text = await page.evaluate(() => document.body.textContent ?? "");
  expect(text).not.toMatch(/[-]/);
  expect(text).not.toContain("{{");
  await page.screenshot({ path: "test-results/preview-row1-light.png", fullPage: true });

  // Row 2: other values, no empty value; time to switch.
  const ms = await show(page, sample, row2, ["ngay_sinh"], "Trần Văn Bình");
  console.log(`row change: ${ms} ms`);
  expect(ms).toBeLessThan(500);
  await expect(pages).toHaveCount(2);
  await expect(page.locator(".ss-empty")).toHaveCount(0);
  await expect(page.getByText("Thử việc 2 tháng").first()).toBeVisible();
  await expect(pages.first().locator("header")).toContainText("HD-002/2026");
  await expect(page.getByText("Nguyễn Thị Hương")).toHaveCount(0);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "test-results/preview-row2-dark.png", fullPage: true });

  expect(errors).toEqual([]);
  await app.close();
});

test("values with special characters show as typed and cannot inject markup or fake a marker", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await open(page);
  const nasty = `<img src=x onerror="window.pwned=1"> & {{ten}} x`;
  await show(page, sample, { ...row1, ghi_chu: nasty }, [], "Ghi chú:");
  await expect(page.getByText("<img src=x", { exact: false }).first()).toBeVisible();
  expect(await page.locator("section.docx img").count()).toBe(0);
  expect(await page.evaluate(() => (window as { pwned?: number }).pwned)).toBeUndefined();
  expect(await page.evaluate(() => document.body.textContent ?? "")).not.toMatch(/[-]/);
  // One value per tag: nine tags in the body plus header and footer, none of them missing.
  await expect(page.locator(".ss-missing")).toHaveCount(0);
  await app.close();
});

test("a link in the document does not move the window", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await open(page);
  await show(page, sample, row1, [], "xem tại đây");
  const before = page.url();
  const link = page.getByText("xem tại đây");
  expect(await link.evaluate((el) => el.closest("a")?.getAttribute("href") ?? null)).toBeNull();
  await link.click();
  await link.click({ button: "middle" });
  expect(page.url()).toBe(before);
  expect(app.windows()).toHaveLength(1);
  await app.close();
});

test("a document the preview cannot draw falls back to plain text with a notice", async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await open(page);
  // A footnotes part that is not XML: the template engine never parses it, docx-preview does and gives up.
  const zip = await JSZip.loadAsync(
    await makeDocx({
      body: paragraph(run("Xin chào {{ten}}, mã {{ma}}.")),
      extra: { "word/footnotes.xml": "<w:footnotes><oops" },
    }),
  );
  const rels = "word/_rels/document.xml.rels";
  const xml = (await zip.file(rels)?.async("string")) ?? "";
  zip.file(
    rels,
    xml.replace(
      "</Relationships>",
      '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>',
    ),
  );
  const broken = await zip.generateAsync({ type: "uint8array" });
  await show(page, broken, { ten: "Hương", ma: "" }, [], "Xin chào");
  await expect(page.locator("pre")).toContainText("Xin chào Hương, mã (trống).");
  await expect(page.getByText("Không vẽ được tài liệu này")).toBeVisible();
  await expect(page.locator(".ss-empty")).toHaveText("(trống)");
  await page.screenshot({ path: "test-results/preview-fallback.png", fullPage: true });
  await app.close();
});
