import type { FontFamilyInfo, FontStyle, TextBox } from "../../../../shared/ipc/images";

export const FONT_STYLES: readonly FontStyle[] = ["normal", "bold", "italic", "bolditalic"];

/** Whether the installed family has a real face for the style. A style without one is never synthesised. */
export function styleAvailable(
  fonts: readonly FontFamilyInfo[],
  family: string,
  style: FontStyle,
): boolean {
  return fonts.find((f) => f.family === family)?.styles.includes(style) ?? false;
}

/** The style to keep when the family changes: the current one if the new family has it, else Thường, else its first. */
export function styleAfterFamilyChange(
  fonts: readonly FontFamilyInfo[],
  family: string,
  current: FontStyle,
): FontStyle {
  if (styleAvailable(fonts, family, current)) return current;
  return FONT_STYLES.find((s) => styleAvailable(fonts, family, s)) ?? current;
}

/** The families named by boxes that are not installed, each once, in order of first use. */
export function missingFamilies(
  boxes: readonly Pick<TextBox, "fontFamily">[],
  fonts: readonly FontFamilyInfo[],
): string[] {
  const installed = new Set(fonts.map((f) => f.family));
  return [...new Set(boxes.map((b) => b.fontFamily))].filter((f) => !installed.has(f));
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const isHexColor = (text: string): boolean => HEX.test(text);

/** The `#rrggbb` an `<input type="color">` can show for any accepted hex (alpha is dropped there). */
export function pickerColor(hex: string): string {
  const h = hex.slice(1);
  if (h.length === 3 || h.length === 4) {
    return `#${[...h.slice(0, 3)].map((c) => c + c).join("")}`.toLowerCase();
  }
  return `#${h.slice(0, 6)}`.toLowerCase();
}
