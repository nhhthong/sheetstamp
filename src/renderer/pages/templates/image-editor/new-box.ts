import type { LayoutBox } from "../../../../shared/image-layout";

export type BoxDefaults = { imageWidth: number; imageHeight: number; fontFamily: string };

/** Size of the font relative to the image height, so a new box is readable at any image size. */
const FONT_RATIO = 0.05;
const WIDTH_RATIO = 0.6;
const MIN_FONT = 8;

/** A new box for `field`, placed near the top left and shifted down by the boxes already there. */
export function newBox(
  field: string,
  existing: number,
  { imageWidth, imageHeight, fontFamily }: BoxDefaults,
  id: string,
): LayoutBox {
  const fontSize = Math.max(MIN_FONT, Math.round(imageHeight * FONT_RATIO));
  const width = Math.max(1, Math.round(imageWidth * WIDTH_RATIO));
  const step = Math.round(fontSize * 1.6);
  const x = Math.round((imageWidth - width) / 2);
  const y = Math.min(
    Math.round(imageHeight * 0.1) + existing * step,
    Math.max(0, imageHeight - fontSize),
  );
  return {
    id,
    field,
    x,
    y,
    width,
    fontSize,
    fontFamily,
    style: "normal",
    color: "#1a1a1a",
    align: "left",
    maxLines: 1,
    overflow: "shrink",
  };
}
