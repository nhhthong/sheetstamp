// Where a box sits relative to a background image. Used to list the boxes that a replacement image would cut.
import type { LayoutBox } from "./index";

/** The height of one line of text, as a multiple of the font size (the editor canvas draws boxes with it). */
export const LINE_HEIGHT = 1.25;

export type BoxFit = "inside" | "partly" | "outside";

/** Position of the box area (width by font size times lines) against an image of the given size, in pixels. */
export function boxFit(
  box: Pick<LayoutBox, "x" | "y" | "width" | "fontSize" | "maxLines">,
  imageWidth: number,
  imageHeight: number,
): BoxFit {
  const right = box.x + box.width;
  const bottom = box.y + box.fontSize * LINE_HEIGHT * box.maxLines;
  if (box.x >= imageWidth || box.y >= imageHeight || right <= 0 || bottom <= 0) return "outside";
  if (box.x < 0 || box.y < 0 || right > imageWidth || bottom > imageHeight) return "partly";
  return "inside";
}
