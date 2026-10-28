import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MARK_CLOSE, MARK_MISSING, MARK_OPEN } from "../../shared/ipc/preview";
import { makeDocx, paragraph, run } from "../selftest/make-docx";
import { EasyTemplateXEngine } from "../template-engine/easy-template-x-engine";
import { fillForPreview, plainText } from "./fill";

const MARKERS = /[-]/;

async function parts(docx: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const xml = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => name.endsWith(".xml"))
      .map((name) => zip.file(name)?.async("string")),
  );
  return xml.join("\n");
}

const template = () =>
  makeDocx({
    body: paragraph(run("Tên: {{ten}}; mã: {{ma}}; ghi chú: {{ghi_chu}}.")),
    header: paragraph(run("Hợp đồng {{ma}}")),
    footer: paragraph(run("{{ten}}")),
  });

describe("fillForPreview", () => {
  it("wraps a value, an empty value and an unmapped tag in markers, in every part", async () => {
    const docx = await template();
    const { docx: out, text } = await fillForPreview({
      docx,
      values: { ten: "Hương", ma: "", ghi_chu: "bỏ qua" },
      unmapped: ["ghi_chu"],
    });
    const xml = await parts(out);
    expect(xml).toContain(`${MARK_OPEN}Hương${MARK_CLOSE}`);
    expect(xml).toContain(`${MARK_OPEN}${MARK_CLOSE}`);
    expect(xml).toContain(`${MARK_OPEN}${MARK_MISSING}ghi_chu${MARK_CLOSE}`);
    expect(xml).not.toContain("bỏ qua");
    expect(xml).not.toContain("{{");
    expect(text).toContain("Hợp đồng ");
    expect(text.split("\n\n")).toHaveLength(3); // header, body, footer
  });

  it("treats a tag with no entry in values as unmapped", async () => {
    const { text } = await fillForPreview({ docx: await template(), values: {}, unmapped: [] });
    expect(text).toContain(`${MARK_OPEN}${MARK_MISSING}ten${MARK_CLOSE}`);
  });

  it("copes with values that hold XML, tag text, line breaks, tabs, spaces and marker characters", async () => {
    const tricky = `a < b & "c" 'd' > {{ten}}\nline two\tTab  ${MARK_OPEN}x${MARK_CLOSE}${MARK_MISSING}  `;
    const { docx, text } = await fillForPreview({
      docx: await template(),
      values: { ten: tricky, ma: "NFD: Hụo̜ng", ghi_chu: "ok" },
      unmapped: [],
    });
    const xml = await parts(docx);
    // Only the markers we wrote: three tags in body and header, plus the footer = 4 values.
    expect((xml.match(//g) ?? []).length).toBe(5);
    expect((xml.match(//g) ?? []).length).toBe(5);
    expect(xml).not.toContain(MARK_MISSING);
    expect(text).toContain("a < b & \"c\" 'd' > {{ten}}");
    expect(text).toContain("line two");
    expect(text).toContain("Tab");
  });

  it("does not change the values it was given", async () => {
    const values = { ten: "A", ma: "B", ghi_chu: "C" };
    await fillForPreview({ docx: await template(), values, unmapped: [] });
    expect(values).toEqual({ ten: "A", ma: "B", ghi_chu: "C" });
  });
});

describe("export never holds a marker", () => {
  it("fills with the real values and no marker, whatever the preview did before", async () => {
    const docx = await template();
    await fillForPreview({ docx, values: { ten: "A", ma: "", ghi_chu: "" }, unmapped: [] });
    const { data, missing } = await new EasyTemplateXEngine().render(docx, {
      ten: "Hương",
      ma: "",
      ghi_chu: "x",
    });
    expect(missing).toEqual([]);
    expect(await parts(data)).not.toMatch(MARKERS);
    expect(await plainText(data)).toContain("Tên: Hương; mã: ; ghi chú: x.");
  });
});

describe("a zip bomb", () => {
  it("is refused by the preview, fast and without inflating", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `<w:document>${"a".repeat(60 * 1024 * 1024)}</w:document>`);
    const bomb = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    const before = process.memoryUsage().arrayBuffers;
    const t = performance.now();
    await expect(plainText(bomb)).rejects.toThrow("quá lớn");
    await expect(fillForPreview({ docx: bomb, values: {}, unmapped: [] })).rejects.toThrow(
      "quá lớn",
    );
    expect(performance.now() - t).toBeLessThan(500);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(20 * 1024 * 1024);
  });
});
