// Runs every .docx in a folder through easy-template-x (same options as the app) and shows what was filled.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TemplateHandler } from "easy-template-x";
import JSZip from "jszip";

const dir = process.argv[2];
const data = {
  ho_ten: "Nguyễn Văn A", so_hop_dong: "HD-01", ngay_sinh: "01/02/1990", cccd: "001234567890", dia_chi: "Hà Nội",
  chuc_vu: "Kế toán", luong: "10.000.000", phong_ban: "Tài chính", email: "a@b.vn", ngay_ky: "28/10/2026",
  ma_nv: "NV01", cu_ten: "CU", "ho ten": "SPACE",
};
const handler = () => new TemplateHandler({ delimiters: { tagStart: "{{", tagEnd: "}}", containerTagOpen: "#", containerTagClose: "/" } });
const textOf = async (zip) => {
  const out = [];
  for (const name of Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n))) {
    const xml = await zip.file(name).async("string");
    out.push(`${name.replace("word/", "")}: ${xml.replace(/<w:delText[^>]*>.*?<\/w:delText>/g, "").replace(/<\/w:p>/g, " / ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}`);
  }
  return out;
};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".docx")).sort()) {
  const bytes = readFileSync(join(dir, file));
  let line = `## ${file}\n`;
  try {
    const tags = (await handler().parseTags(bytes)).map((t) => t.rawText);
    line += `tags found: ${JSON.stringify(tags)}\n`;
    const out = await handler().process(bytes, data);
    const zip = await JSZip.loadAsync(out);
    const texts = await textOf(zip);
    const left = texts.filter((t) => t.includes("{{"));
    line += texts.map((t) => `  ${t.slice(0, 200)}`).join("\n") + `\n${left.length ? "LEFT OVER {{ in: " + left.map((t) => t.split(":")[0]).join(", ") : "all tags replaced"}\n`;
  } catch (error) {
    line += `ERROR: ${error.message}\n`;
  }
  console.log(line);
}
