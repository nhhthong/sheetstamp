import { describe, expect, it } from "vitest";
import { type Chip, chipsOf, patternOf } from "./export-pattern";

describe("chipsOf and patternOf", () => {
  it("splits fixed text and fields in order", () => {
    expect(chipsOf("{{ten}}_Thử việc")).toEqual([
      { type: "field", key: "ten" },
      { type: "text", value: "_Thử việc" },
    ]);
  });

  it("round-trips a pattern", () => {
    for (const pattern of ["{{ten}}", "{{ma}}_{{ten}}_Thử việc", "chỉ chữ", "a{{b}}c{{d}}"]) {
      expect(patternOf(chipsOf(pattern))).toBe(pattern);
    }
  });

  it("trims spaces inside the braces and uses NFC keys like main", () => {
    expect(chipsOf("{{ ten }}")).toEqual([{ type: "field", key: "ten" }]);
    expect(chipsOf("{{ho_tên}}")).toEqual([{ type: "field", key: "ho_tên" }]);
  });

  it("keeps two fixed-text chips separate while they are edited", () => {
    const chips: Chip[] = [
      { type: "text", value: "_a" },
      { type: "text", value: "_b" },
    ];
    expect(patternOf(chips)).toBe("_a_b");
  });

  it("an empty pattern has no chips", () => {
    expect(chipsOf("")).toEqual([]);
    expect(patternOf([])).toBe("");
  });
});
