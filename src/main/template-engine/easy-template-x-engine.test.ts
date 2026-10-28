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
