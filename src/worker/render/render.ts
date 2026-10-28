import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { hasFamily } from "./fonts";
import { type ImageTemplate, type OutputFormat, RenderError, type TextBox } from "./types";

const LINE_HEIGHT = 1.25;
/** Shrinking stops at this share of the chosen size; text that still does not fit is truncated. */
const MIN_SHRINK = 0.4;
const ELLIPSIS = "…";

const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
const graphemes = (text: string) => [...segmenter.segment(text)].map((s) => s.segment);

function fontString(box: TextBox, size: number): string {
  const italic = box.style === "italic" || box.style === "bolditalic" ? "italic " : "";
  const bold = box.style === "bold" || box.style === "bolditalic" ? "bold " : "";
  return `${italic}${bold}${size}px "${box.fontFamily}"`;
}

type Measure = (text: string) => number;

/** Cut `text` so that it plus an ellipsis fits `width`. */
function ellipsize(text: string, width: number, measure: Measure): string {
  if (measure(text) <= width) return text;
  const parts = graphemes(text);
  while (parts.length > 0 && measure(parts.join("").trimEnd() + ELLIPSIS) > width) parts.pop();
  return parts.join("").trimEnd() + ELLIPSIS;
}

/** Break into lines at spaces; a word wider than the box is broken between letters. */
function wrapLines(text: string, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => {
    lines.push(line.trimEnd());
    line = "";
  };
  for (const word of text.split(/(?<= )/)) {
    if (measure((line + word).trimEnd()) <= width) {
      line += word;
      continue;
    }
    if (line !== "") push();
    if (measure(word.trimEnd()) <= width) {
      line = word;
      continue;
    }
    for (const g of graphemes(word)) {
      if (measure((line + g).trimEnd()) > width && line !== "") push();
      line += g;
    }
  }
  if (line !== "") push();
  return lines;
}

type Layout = { size: number; lines: string[] };

/** Decide font size and lines for one box. Throws `text-too-long` for overflow `error`. */
function layout(ctx: SKRSContext2D, box: TextBox, text: string): Layout {
  const measureAt = (size: number): Measure => {
    ctx.font = fontString(box, size);
    return (t) => ctx.measureText(t).width;
  };
  const maxLines = Math.max(1, Math.floor(box.maxLines));
  const single = text.replace(/\s*\n\s*/g, " ").trim();

  switch (box.overflow) {
    case "error": {
      if (measureAt(box.fontSize)(single) > box.width)
        throw new RenderError("text-too-long", box.field);
      return { size: box.fontSize, lines: [single] };
    }
    case "truncate": {
      return { size: box.fontSize, lines: [ellipsize(single, box.width, measureAt(box.fontSize))] };
    }
    case "shrink": {
      const min = Math.max(1, Math.floor(box.fontSize * MIN_SHRINK));
      for (let size = box.fontSize; size >= min; size--) {
        const measure = measureAt(size);
        const lines = maxLines === 1 ? [single] : wrapLines(single, box.width, measure);
        if (lines.length <= maxLines && lines.every((l) => measure(l) <= box.width))
          return { size, lines };
      }
      const measure = measureAt(min);
      const lines = maxLines === 1 ? [single] : wrapLines(single, box.width, measure);
      const kept = lines.slice(0, maxLines);
      kept[kept.length - 1] = ellipsize(lines.slice(maxLines - 1).join(" "), box.width, measure);
      return { size: min, lines: kept };
    }
    default: {
      const measure = measureAt(box.fontSize);
      const lines = wrapLines(single, box.width, measure);
      if (lines.length <= maxLines) return { size: box.fontSize, lines };
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = ellipsize(lines.slice(maxLines - 1).join(" "), box.width, measure);
      return { size: box.fontSize, lines: kept };
    }
  }
}

export type RenderResult = { data: Uint8Array };

/**
 * The one function that draws an image template. Preview and export both call it,
 * so what the user sees is what is written.
 * `values` is keyed by tag key; a missing key draws nothing (the mapping step flags it earlier).
 */
export async function renderImage(
  template: ImageTemplate,
  values: Readonly<Record<string, string>>,
  format: OutputFormat = { type: "png" },
): Promise<RenderResult> {
  let background: Awaited<ReturnType<typeof loadImage>>;
  try {
    background = await loadImage(Buffer.from(template.background));
  } catch {
    throw new RenderError("bad-background");
  }
  for (const box of template.boxes) {
    if (!hasFamily(box.fontFamily)) throw new RenderError("font-missing", box.fontFamily);
  }
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(background, 0, 0);

  const lookup = new Map(Object.entries(values).map(([k, v]) => [k.normalize("NFC"), v]));
  for (const box of template.boxes) {
    const text = (lookup.get(box.field.normalize("NFC")) ?? "").normalize("NFC");
    if (text.trim() === "") continue;
    const { size, lines } = layout(ctx, box, text);
    ctx.font = fontString(box, size);
    ctx.fillStyle = box.color;
    ctx.textAlign = box.align;
    ctx.textBaseline = "alphabetic";
    const x =
      box.align === "left"
        ? box.x
        : box.align === "center"
          ? box.x + box.width / 2
          : box.x + box.width;
    const ascent = ctx.measureText("Hg").fontBoundingBoxAscent ?? size * 0.9;
    lines.forEach((line, i) => ctx.fillText(line, x, box.y + ascent + i * size * LINE_HEIGHT));
  }
  const data =
    format.type === "png"
      ? canvas.toBuffer("image/png")
      : canvas.toBuffer("image/jpeg", Math.round(format.quality));
  return { data: new Uint8Array(data) };
}
