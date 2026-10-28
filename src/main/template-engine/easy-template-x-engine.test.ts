import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CASES } from "../../../tests/fixtures/word/templates";
import { makeDocx, normalizedXml, paragraph, run, textOf } from "../selftest/make-docx";
import { EasyTemplateXEngine } from "./easy-template-x-engine";
import type { TemplateEngine } from "./types";

const GOLDEN = join(import.meta.dirname, "../../../tests/fixtures/word/golden");
const engine: TemplateEngine = new EasyTemplateXEngine();

describe("EasyTemplateXEngine: self-written templates", () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it("lists the unique tags", async () => {
        const docx = await makeDocx(c.parts);
        const tags = (await engine.parseTags(docx)).map((t) => t.key);
        expect([...tags].sort()).toEqual([...c.tags].sort());
      });

      it("fills the document and matches the golden XML", async () => {
        const docx = await makeDocx(c.parts);
        const { data, missing } = await engine.render(docx, c.values);
        expect(missing).toEqual([]);
        expect(await textOf(data, "word/document.xml")).toBe(c.body);

        const file = join(GOLDEN, `${c.name}.xml`);
        const actual = await normalizedXml(data);
        if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
          mkdirSync(GOLDEN, { recursive: true });
          writeFileSync(file, actual);
        }
        expect(actual).toBe(readFileSync(file, "utf8"));
      });
    });
  }
});

describe("EasyTemplateXEngine: behaviours", () => {
  it("fills header and footer", async () => {
    const docx = await makeDocx(CASES[0]!.parts);
    const { data } = await engine.render(docx, CASES[0]!.values);
    expect(await textOf(data, "word/header1.xml")).toBe("Phòng nhân sự – Nguyễn Thị Hương");
    expect(await textOf(data, "word/footer1.xml")).toBe("Số: HD-001");
  });

  it("keeps the format of the first run when a tag is split", async () => {
    const docx = await makeDocx({ body: paragraph(run("{{t", true), run("en}}")) });
    const { data } = await engine.render(docx, { ten: "A" });
    const xml = await normalizedXml(data);
    expect(xml).toMatch(/<w:b\/>[\s\S]*<w:t[^>]*>A<\/w:t>/);
  });

  it("reports a tag with no value and leaves its text visible", async () => {
    const docx = await makeDocx({ body: paragraph(run("{{ten}} {{chuc_vu}}")) });
    const { data, missing } = await engine.render(docx, { ten: "A" });
    expect(missing).toEqual(["chuc_vu"]);
    expect(await textOf(data, "word/document.xml")).toBe("A {{chuc_vu}}");
  });

  it("flags loop markers as unsupported and does not render them", async () => {
    const docx = await makeDocx({ body: paragraph(run("{{#ds}}{{ten}}{{/ds}}")) });
    const tags = await engine.parseTags(docx);
    expect(tags.filter((t) => t.kind === "unsupported").map((t) => t.raw)).toEqual([
      "{{#ds}}",
      "{{/ds}}",
    ]);
    expect(tags.find((t) => t.key === "ten")?.kind).toBe("field");
  });

  it("returns each tag once", async () => {
    const docx = await makeDocx({ body: paragraph(run("{{ten}} {{ten}} {{ ten }}")) });
    const tags = await engine.parseTags(docx);
    expect(tags.filter((t) => t.key === "ten")).toHaveLength(1);
  });
});

describe("EasyTemplateXEngine: documents as Word writes them", () => {
  it("fills a tag split by a tracked insertion, and ignores deleted text", async () => {
    const docx = await makeDocx({
      body:
        '<w:p><w:r><w:t xml:space="preserve">Lương: </w:t></w:r>' +
        '<w:ins w:id="10" w:author="HR" w:date="2026-10-01T00:00:00Z"><w:r><w:t>{{lu</w:t></w:r></w:ins>' +
        "<w:r><w:t>ong}}</w:t></w:r></w:p>" +
        '<w:p><w:del w:id="11" w:author="HR" w:date="2026-10-01T00:00:00Z"><w:r><w:delText>{{cu_ten}}</w:delText></w:r></w:del>' +
        "<w:r><w:t>{{ho_ten}}</w:t></w:r></w:p>",
    });
    const tags = (await engine.parseTags(docx)).map((t) => t.key).sort();
    expect(tags).toEqual(["ho_ten", "luong"]);
    const { data, missing } = await engine.render(docx, {
      luong: "10.000.000",
      ho_ten: "Nguyễn Văn A",
    });
    expect(missing).toEqual([]);
    expect(await textOf(data, "word/document.xml")).toBe("Lương: 10.000.000\nNguyễn Văn A");
  });

  it("fills tags inside a text box, a content control, a hyperlink and a field result", async () => {
    const docx = await makeDocx({
      body:
        '<w:sdt><w:sdtPr><w:tag w:val="x"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>A {{ten}}</w:t></w:r></w:p></w:sdtContent></w:sdt>' +
        '<w:p><w:hyperlink w:anchor="x"><w:r><w:t>B {{ten}}</w:t></w:r></w:hyperlink></w:p>' +
        '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> DATE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>C {{ten}}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
        '<w:p><w:r><w:pict><v:shape xmlns:v="urn:schemas-microsoft-com:vml"><v:textbox><w:txbxContent><w:p><w:r><w:t>D {{ten}}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>',
    });
    const { data, missing } = await engine.render(docx, { ten: "X" });
    expect(missing).toEqual([]);
    const text = await textOf(data, "word/document.xml");
    for (const letter of ["A", "B", "C", "D"]) expect(text).toContain(`${letter} X`);
    expect(text).not.toContain("{{");
  });

  it("lists tags that sit in footnotes as unsupported, because they are not filled", async () => {
    const docx = await makeDocx({
      body: paragraph(run("{{ten}}")),
      extra: {
        "word/footnotes.xml":
          '<?xml version="1.0"?><w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>Ghi chú {{ten}} và {{chuc_vu}}</w:t></w:r></w:p></w:footnote></w:footnotes>',
      },
    });
    const tags = await engine.parseTags(docx);
    expect(tags.filter((t) => t.kind === "unsupported").map((t) => t.raw)).toEqual([
      "{{ten}}",
      "{{chuc_vu}}",
    ]);
  });

  it("treats a non-breaking space inside the braces like a space", async () => {
    const docx = await makeDocx({ body: paragraph(run("Họ tên: {{ ho_ten }}")) });
    expect((await engine.parseTags(docx)).map((t) => t.key)).toEqual(["ho_ten"]);
    const { data } = await engine.render(docx, { ho_ten: "A" });
    expect(await textOf(data, "word/document.xml")).toBe("Họ tên: A");
  });
});
