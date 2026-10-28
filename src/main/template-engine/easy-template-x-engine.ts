import { TagDisposition, TemplateHandler } from "easy-template-x";
import JSZip from "jszip";
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

const REVIEWED_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;
const NOTE_PARTS = /^word\/(footnotes|endnotes|comments)\.xml$/;

/**
 * Show a document the way it reads once every tracked change is accepted: deleted text goes, inserted
 * text stays. The engine cannot join text across a tracked change (prototype spike6), and a template
 * edited by several people often has them.
 */
export function acceptTrackedChanges(xml: string): string {
  return xml
    .replace(/<w:(del|moveFrom)\b[^>]*?\/>/g, "") // paragraph-mark markers
    .replace(/<w:(del|moveFrom)\b[^>]*>[\s\S]*?<\/w:\1>/g, "")
    .replace(/<w:(ins|moveTo)\b[^>]*?\/>/g, "")
    .replace(/<\/?w:(ins|moveTo)\b[^>]*>/g, "")
    .replace(
      /<w:(moveFromRangeStart|moveFromRangeEnd|moveToRangeStart|moveToRangeEnd)\b[^>]*\/>/g,
      "",
    );
}

async function prepare(docx: Uint8Array): Promise<{ bytes: Uint8Array; notes: string[] }> {
  const zip = await JSZip.loadAsync(docx);
  let changed = false;
  const notes: string[] = [];
  for (const name of Object.keys(zip.files)) {
    if (REVIEWED_PARTS.test(name)) {
      const xml = await zip.file(name)?.async("string");
      if (xml === undefined) continue;
      const accepted = acceptTrackedChanges(xml);
      if (accepted !== xml) {
        zip.file(name, accepted);
        changed = true;
      }
    } else if (NOTE_PARTS.test(name)) {
      const text = ((await zip.file(name)?.async("string")) ?? "").replace(/<[^>]+>/g, "");
      notes.push(...(text.match(/\{\{[^{}]+\}\}/g) ?? []));
    }
  }
  return { bytes: changed ? await zip.generateAsync({ type: "uint8array" }) : docx, notes };
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

type Analysis = {
  bytes: Uint8Array;
  notes: string[];
  tags: Awaited<ReturnType<typeof readTags>>;
};

// A batch fills the same template thousands of times; analyze each template object once.
const analyses = new WeakMap<Uint8Array, Promise<Analysis>>();

function analyze(docx: Uint8Array): Promise<Analysis> {
  let cached = analyses.get(docx);
  if (!cached) {
    cached = prepare(docx).then(async ({ bytes, notes }) => ({
      bytes,
      notes,
      tags: await readTags(bytes),
    }));
    analyses.set(docx, cached);
  }
  return cached;
}

export class EasyTemplateXEngine implements TemplateEngine {
  async parseTags(docx: Uint8Array): Promise<TemplateTag[]> {
    const seen = new Set<string>();
    const result: TemplateTag[] = [];
    const { notes, tags } = await analyze(docx);
    for (const tag of tags) {
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
    // Tags in footnotes, endnotes and comments are not filled; list them so the app can warn.
    for (const raw of notes) {
      const id = `u:${raw}`;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({ key: keyOf(raw), raw, kind: "unsupported" });
    }
    return result;
  }

  async render(docx: Uint8Array, values: Readonly<Record<string, string>>): Promise<RenderResult> {
    const normalized = new Map(Object.entries(values).map(([k, v]) => [nfc(k), v]));
    const data: Record<string, string> = {};
    const missing = new Set<string>();
    const { bytes, tags } = await analyze(docx);
    for (const tag of tags) {
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
    const output = await handler().process(Buffer.from(bytes), data);
    return { data: new Uint8Array(output), missing: [...missing] };
  }
}
