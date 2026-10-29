import { describe, expect, it } from "vitest";
import { defaultFont } from "./default-font";

const list = (...names: string[]) => names.map((family) => ({ family }));

describe("defaultFont", () => {
  it("prefers a known family over the alphabetical first", () => {
    expect(defaultFont(list("Courier 10 Pitch", "DejaVu Sans", "Zapf"))).toBe("DejaVu Sans");
    expect(defaultFont(list("Bitstream Charter", "Inter", "Ubuntu"))).toBe("Inter");
  });
  it("skips monospace and symbol faces when nothing known is installed", () => {
    expect(defaultFont(list("Courier 10 Pitch", "FreeMono", "Zilla Slab"))).toBe("Zilla Slab");
  });
  it("falls back to the first family, and to null when there are none", () => {
    expect(defaultFont(list("Courier 10 Pitch", "Noto Mono"))).toBe("Courier 10 Pitch");
    expect(defaultFont([])).toBeNull();
  });
});
