import { TagDisposition, TemplateHandler } from "easy-template-x";
import type { RenderResult, TemplateEngine, TemplateTag } from "./types";

export const nfc = (text: string): string => text.normalize("NFC");

const handler = (): TemplateHandler =>
  new TemplateHandler({
    delimiters: {
      tagStart: "{{",
      tagEnd: "}}",
      containerTagOpen: "#",
      containerTagClose: "/",
    },
  });

/** Name inside the delimiters, without loop marks, spaces or composed-versus-decomposed differences. */
function keyOf(rawText: string): string {
  return nfc(rawText.slice(2, -2).trim().replace(/^[#/]/, "").trim());
}

async function readTags(docx: Uint8Array) {
  const tags = await handler().parseTags(Buffer.from(docx));
  return tags.map((tag) => ({
    raw: tag.rawText,
    name: tag.rawText.slice(2, -2).trim(),
    key: keyOf(tag.rawText),
    unsupported: tag.disposition !== TagDisposition.SelfClosed,
  }));
}

export class EasyTemplateXEngine implements TemplateEngine {
  async parseTags(docx: Uint8Array): Promise<TemplateTag[]> {
    const seen = new Set<string>();
    const result: TemplateTag[] = [];
    for (const tag of await readTags(docx)) {
      // Fields are unique by key (`{{ten}}` and `{{ ten }}` are one field); loop marks keep their raw text.
      const id = tag.unsupported ? `u:${tag.raw}` : `f:${tag.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({
        key: tag.key,
        raw: tag.raw,
        kind: tag.unsupported ? "unsupported" : "field",
      });
    }
    return result;
  }

  async render(docx: Uint8Array, values: Readonly<Record<string, string>>): Promise<RenderResult> {
    const normalized = new Map(Object.entries(values).map(([k, v]) => [nfc(k), v]));
    const data: Record<string, string> = {};
    const missing = new Set<string>();
    for (const tag of await readTags(docx)) {
      if (tag.unsupported) continue;
      const value = normalized.get(tag.key);
      if (value === undefined) {
        // The library would write an empty string. Keep the tag text visible instead.
        missing.add(tag.key);
        data[tag.name] = tag.raw;
      } else {
        data[tag.name] = value;
      }
    }
    const output = await handler().process(Buffer.from(docx), data);
    return { data: new Uint8Array(output), missing: [...missing] };
  }
}
