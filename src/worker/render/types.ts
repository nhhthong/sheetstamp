export type FontStyle = "normal" | "bold" | "italic" | "bolditalic";
export type Align = "left" | "center" | "right";
/** What to do when the text does not fit its box. */
export type Overflow = "shrink" | "wrap" | "truncate" | "error";

export type TextBox = {
  /** Tag key (NFC) whose value is drawn. */
  field: string;
  x: number;
  y: number;
  width: number;
  /** Font size in pixels of the background image. */
  fontSize: number;
  fontFamily: string;
  style: FontStyle;
  /** CSS color, for example `#1a1a1a`. */
  color: string;
  align: Align;
  maxLines: number;
  overflow: Overflow;
};

export type ImageTemplate = {
  /** PNG or JPEG bytes. */
  background: Uint8Array;
  boxes: TextBox[];
};

export type OutputFormat = { type: "png" } | { type: "jpeg"; quality: number };

export type RenderErrorCode = "font-missing" | "text-too-long" | "bad-background";

/** Row-level failure: the caller records the row and goes on. */
export class RenderError extends Error {
  constructor(
    readonly code: RenderErrorCode,
    readonly field?: string,
  ) {
    super(code);
    this.name = "RenderError";
  }
}
