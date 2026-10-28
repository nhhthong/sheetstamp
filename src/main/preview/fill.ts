import JSZip from "jszip";
import {
  MARK_CLOSE,
  MARK_MISSING,
  MARK_OPEN,
  MARKER_PATTERN,
  type PreviewRequest,
  type PreviewResponse,
} from "../../shared/ipc/preview";
import { EasyTemplateXEngine } from "../template-engine/easy-template-x-engine";
import type { TemplateEngine } from "../template-engine/types";

const engine: TemplateEngine = new EasyTemplateXEngine();

/** A value that already holds a marker character (from a spreadsheet cell) must not fake a marker. */
const clean = (text: string) => text.replace(MARKER_PATTERN, "");

const PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** Visible text of the header, body and footer: the fallback when the document cannot be drawn. */
export async function plainText(docx: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const names = Object.keys(zip.files)
    .filter((name) => PARTS.test(name))
    .sort();
  // header, body, footer
  const ordered = [
    ...names.filter((n) => /header/.test(n)),
    ...names.filter((n) => /document/.test(n)),
    ...names.filter((n) => /footer/.test(n)),
  ];
  const out: string[] = [];
  for (const name of ordered) {
    const xml = (await zip.file(name)?.async("string")) ?? "";
    const text = decode(
      xml
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/w:tc>/g, "\t")
        .replace(/<[^>]+>/g, ""),
    ).trim();
    if (text) out.push(text);
  }
  return out.join("\n\n");
}

/**
 * Fill the template for display. Every value goes between MARK_OPEN and MARK_CLOSE; a tag with no value
 * gets MARK_MISSING and its key between them. Never use the result as an export.
 */
export async function fillForPreview(
  request: PreviewRequest,
  templateEngine: TemplateEngine = engine,
): Promise<PreviewResponse> {
  const unmapped = new Set(request.unmapped);
  const marked: Record<string, string> = {};
  for (const tag of await templateEngine.parseTags(request.docx)) {
    if (tag.kind !== "field") continue;
    const value = request.values[tag.key];
    marked[tag.key] =
      unmapped.has(tag.key) || value === undefined
        ? `${MARK_OPEN}${MARK_MISSING}${clean(tag.key)}${MARK_CLOSE}`
        : `${MARK_OPEN}${clean(value)}${MARK_CLOSE}`;
  }
  const { data } = await templateEngine.render(request.docx, marked);
  return { docx: data, text: await plainText(data) };
}
