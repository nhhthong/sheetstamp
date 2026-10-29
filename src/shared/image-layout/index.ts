// Persisted layout of an image template: the text boxes drawn on the background. Stored in the opaque
// `imageLayout` field of the template record. Shared by the library (T-28) and the editor and export (T-29..T-33).
import { arrayOf, IpcValidationError, record, string } from "../ipc/define";
import { MAX_BOXES, parseBox, type TextBox } from "../ipc/images";

export const IMAGE_LAYOUT_VERSION = 1;

/** A render `TextBox` plus a stable id for the editor. Positions and sizes are in pixels of the background image. */
export type LayoutBox = TextBox & { id: string };

export type ImageLayout = { version: typeof IMAGE_LAYOUT_VERSION; boxes: LayoutBox[] };

/** `newer`: written by a newer app, must not be read or overwritten. `invalid`: not a layout this app wrote. */
export type LayoutResult =
  | { ok: true; layout: ImageLayout }
  | { ok: false; reason: "newer" | "invalid" };

export const emptyImageLayout = (): ImageLayout => ({ version: IMAGE_LAYOUT_VERSION, boxes: [] });

function parseLayoutBox(value: unknown, index: number): LayoutBox {
  const id = string(record(value, `box ${index}`).id, "id", { min: 1, max: 200 });
  return { id, ...parseBox(value, index) };
}

/** Checks a stored layout. Never throws; the caller decides what to do with a refused one. */
export function parseImageLayout(value: unknown): LayoutResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, reason: "invalid" };
  }
  const { version, boxes } = value as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: "invalid" };
  }
  if (version > IMAGE_LAYOUT_VERSION) return { ok: false, reason: "newer" };
  try {
    const parsed = arrayOf(boxes, "boxes", parseLayoutBox, MAX_BOXES);
    if (new Set(parsed.map((b) => b.id)).size !== parsed.length) {
      throw new IpcValidationError("box ids must be unique");
    }
    return { ok: true, layout: { version: IMAGE_LAYOUT_VERSION, boxes: parsed } };
  } catch (error) {
    if (error instanceof IpcValidationError) return { ok: false, reason: "invalid" };
    throw error;
  }
}
