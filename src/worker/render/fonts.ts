import { GlobalFonts } from "@napi-rs/canvas";
import type { FontStyle, TextBox } from "./types";

export type FontFamily = { family: string; styles: FontStyle[] };

const STYLE_ORDER: FontStyle[] = ["normal", "bold", "italic", "bolditalic"];

/** Weights 300 to 500 count as the regular face, 600 and above as bold. */
function styleOf(weight: number, style: string): FontStyle | undefined {
  const italic = style === "italic" || style === "oblique";
  if (weight >= 300 && weight <= 500) return italic ? "italic" : "normal";
  if (weight >= 600) return italic ? "bolditalic" : "bold";
  return undefined;
}

/** Installed families with only the styles that have a real face (no synthetic bold or italic). */
export function listFamilies(): FontFamily[] {
  return GlobalFonts.families
    .map(({ family, styles }) => ({
      family,
      styles: STYLE_ORDER.filter((wanted) =>
        styles.some((s) => styleOf(s.weight, s.style) === wanted),
      ),
    }))
    .filter((f) => f.styles.length > 0)
    .sort((a, b) => a.family.localeCompare(b.family));
}

export const hasFamily = (family: string) => GlobalFonts.families.some((f) => f.family === family);

export function availableStyles(family: string): FontStyle[] {
  return listFamilies().find((f) => f.family === family)?.styles ?? [];
}

/**
 * Pick up fonts installed while the app runs. The canvas library does not rescan by itself
 * (prototype in spike T-2); loading a folder twice does not duplicate faces.
 */
export function refreshFonts(folders: readonly string[]): number {
  let loaded = 0;
  for (const folder of folders) {
    try {
      loaded += GlobalFonts.loadFontsFromDir(folder);
    } catch {
      // A folder that does not exist on this system is fine.
    }
  }
  return loaded;
}

/** Font folders a user can install into, per operating system. */
export function systemFontFolders(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  home: string,
): string[] {
  if (platform === "win32") {
    return [
      `${env.WINDIR ?? "C:\\Windows"}\\Fonts`,
      `${env.LOCALAPPDATA ?? `${home}\\AppData\\Local`}\\Microsoft\\Windows\\Fonts`,
    ];
  }
  if (platform === "darwin")
    return ["/System/Library/Fonts", "/Library/Fonts", `${home}/Library/Fonts`];
  return [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    `${home}/.fonts`,
    `${home}/.local/share/fonts`,
  ];
}

/** Fonts a template uses that this computer no longer has. The app never substitutes one silently. */
export function missingFonts(boxes: readonly Pick<TextBox, "fontFamily">[]): string[] {
  return [...new Set(boxes.map((b) => b.fontFamily))].filter((family) => !hasFamily(family));
}
