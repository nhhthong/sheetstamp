import JSZip from "jszip";

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** One run. `bold` only changes formatting, so tests can see which format a value takes. */
export const run = (text: string, bold = false) =>
  `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;

export const paragraph = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;

export const table = (...cells: string[]) =>
  `<w:tbl><w:tr>${cells.map((cell) => `<w:tc>${cell}</w:tc>`).join("")}</w:tr></w:tbl>`;

export type DocxParts = { body: string; header?: string; footer?: string };

export async function makeDocx({ body, header = "", footer = "" }: DocxParts): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/header1.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:hdr ${NS}>${header}</w:hdr>`,
  );
  zip.file(
    "word/footer1.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:ftr ${NS}>${footer}</w:ftr>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

const PARTS = ["word/document.xml", "word/header1.xml", "word/footer1.xml"] as const;

/** Normalized XML of the three parts: no declaration, one element per line. Used for golden files. */
export async function normalizedXml(docx: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const out: string[] = [];
  for (const name of PARTS) {
    const xml = await zip.file(name)?.async("string");
    if (xml === undefined) throw new Error(`Missing ${name}`);
    out.push(
      `<!-- ${name} -->`,
      xml
        .replace(/<\?xml[^>]*\?>/, "")
        .replace(/>\s*</g, ">\n<")
        .trim(),
    );
  }
  return `${out.join("\n")}\n`;
}

/** Visible text of each part, paragraphs joined with a newline. */
export async function textOf(docx: Uint8Array, part: (typeof PARTS)[number]): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const xml = (await zip.file(part)?.async("string")) ?? "";
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}
