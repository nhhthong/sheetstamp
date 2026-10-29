// IPC channels of the "images" feature (fonts and the image template render), handled in src/main/ipc/images.ts.
// The drawing itself runs in a worker thread: main and the window never load the canvas library.
import type { FontStyle, RenderErrorCode, TextBox } from "../../worker/render/types";
import {
  arrayOf,
  bytes,
  channel,
  IpcValidationError,
  integer,
  nothing,
  oneOf,
  record,
  string,
} from "./define";

export type { FontStyle, RenderErrorCode, TextBox };

/** An installed family with only the styles it really has a face for. */
export type FontFamilyInfo = { family: string; styles: FontStyle[] };

/** Provisional: spike T-24 sets the final background limits. */
export const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;
const MAX_BOXES = 200;
const MAX_VALUES = 5000;

export type RenderRequest = {
  /** The background image (PNG or JPEG bytes). */
  background: Uint8Array;
  boxes: TextBox[];
  /** One row's values keyed by tag key; for a sample, the field labels. */
  values: Record<string, string>;
};

/** A row-level failure comes back as a code, never as an exception. `field` is the tag key (the font family for `font-missing`). */
export type RenderResponse =
  | { ok: true; png: Uint8Array }
  | { ok: false; code: RenderErrorCode; field?: string };

const STYLES = ["normal", "bold", "italic", "bolditalic"] as const satisfies readonly FontStyle[];
const ALIGNS = ["left", "center", "right"] as const;
const OVERFLOWS = ["shrink", "wrap", "truncate", "error"] as const;
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function finite(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new IpcValidationError(`${what} must be a number`);
  if (value < min || value > max) throw new IpcValidationError(`${what} is out of range`);
  return value;
}

function parseBox(value: unknown, index: number): TextBox {
  const box = record(value, `box ${index}`);
  const color = string(box.color, "color", { max: 9 });
  if (!HEX_COLOR.test(color)) throw new IpcValidationError("color must be a hex color");
  return {
    field: string(box.field, "field", { min: 1, max: 1000 }),
    x: finite(box.x, "x", -100_000, 100_000),
    y: finite(box.y, "y", -100_000, 100_000),
    width: finite(box.width, "width", 1, 100_000),
    fontSize: finite(box.fontSize, "fontSize", 1, 10_000),
    fontFamily: string(box.fontFamily, "fontFamily", { min: 1, max: 200 }),
    style: oneOf(box.style, "style", STYLES),
    color,
    align: oneOf(box.align, "align", ALIGNS),
    maxLines: integer(box.maxLines, "maxLines", { min: 1, max: 100 }),
    overflow: oneOf(box.overflow, "overflow", OVERFLOWS),
  };
}

function parseRenderRequest(value: unknown): RenderRequest {
  const request = record(value);
  const rawValues = record(request.values, "values");
  const keys = Object.keys(rawValues);
  if (keys.length > MAX_VALUES) throw new IpcValidationError("values has too many items");
  const values: Record<string, string> = {};
  for (const key of keys) values[key] = string(rawValues[key], `value of ${key}`, { max: 100_000 });
  return {
    background: bytes(request.background, "background", MAX_BACKGROUND_BYTES),
    boxes: arrayOf(request.boxes, "boxes", parseBox, MAX_BOXES),
    values,
  };
}

export const listFonts = channel<undefined, FontFamilyInfo[]>("fonts:list", nothing);
export const render = channel<RenderRequest, RenderResponse>("image:render", parseRenderRequest);

export const channels = [listFonts, render] as const;
export const events = [] as const;
