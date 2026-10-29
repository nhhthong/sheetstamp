import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");

/** Custom properties declared in the first rule whose selector line starts with `selector` (comments ignored). */
function tokens(selector: string): Record<string, string> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No rule for ${selector}`);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) out[name] = value.trim();
  }
  return out;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt((match[1] as string).slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: tokens(":root"),
  dark: tokens(':root[data-theme="dark"]'),
};

/**
 * Every pairing the UI really uses for text: body and secondary text on both surfaces; the accent and the three
 * status colours (green success, yellow warning, red danger) and grey (muted, the "info" status) as text on both
 * surfaces; warning and danger text on their tinted backgrounds; button labels on accent and danger fills.
 */
const TEXT_PAIRS: [fg: string, bg: string][] = [
  ["text", "bg"],
  ["text", "panel"],
  ["muted", "bg"],
  ["muted", "panel"],
  ["accent", "bg"],
  ["accent", "panel"],
  ["success", "bg"],
  ["success", "panel"],
  ["warning", "bg"],
  ["warning", "panel"],
  ["danger", "bg"],
  ["danger", "panel"],
  ["warning", "warning-bg"],
  ["danger", "danger-bg"],
  ["on-accent", "accent"],
  ["on-accent", "danger"],
];

describe("theme tokens", () => {
  it("defines the same tokens in light and dark", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("repeats the dark values under prefers-color-scheme (System) and [data-theme=dark] (Tối)", () => {
    expect(tokens(':root:not([data-theme="light"])')).toEqual(themes.dark);
  });

  for (const [name, values] of Object.entries(themes)) {
    describe(`${name} theme text contrast (WCAG AA, at least 4.5:1)`, () => {
      for (const [fg, bg] of TEXT_PAIRS) {
        it(`${fg} on ${bg}`, () => {
          const foreground = values[fg];
          const background = values[bg];
          if (!foreground || !background) throw new Error(`Missing token ${fg} or ${bg}`);
          const ratio = contrast(foreground, background);
          expect(
            ratio,
            `${fg} ${foreground} on ${bg} ${background} = ${ratio.toFixed(2)}`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  it("computes known ratios correctly", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});
