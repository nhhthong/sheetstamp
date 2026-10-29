import { describe, expect, it } from "vitest";
import {
  isHexColor,
  missingFamilies,
  pickerColor,
  styleAfterFamilyChange,
  styleAvailable,
} from "./inspector";

const fonts = [
  { family: "Full", styles: ["normal", "bold", "italic", "bolditalic"] as const },
  { family: "Plain", styles: ["normal"] as const },
].map((f) => ({ family: f.family, styles: [...f.styles] }));

describe("style availability", () => {
  it("is true only for styles the family has a face for", () => {
    expect(styleAvailable(fonts, "Full", "bolditalic")).toBe(true);
    expect(styleAvailable(fonts, "Plain", "normal")).toBe(true);
    expect(styleAvailable(fonts, "Plain", "bold")).toBe(false);
    expect(styleAvailable(fonts, "Plain", "italic")).toBe(false);
    expect(styleAvailable(fonts, "Plain", "bolditalic")).toBe(false);
  });
  it("is false for a family that is not installed", () => {
    expect(styleAvailable(fonts, "Gone", "normal")).toBe(false);
  });
  it("falls back to a real style when the family changes, never keeps a missing one", () => {
    expect(styleAfterFamilyChange(fonts, "Full", "bold")).toBe("bold");
    expect(styleAfterFamilyChange(fonts, "Plain", "bold")).toBe("normal");
  });
});

describe("missing families", () => {
  it("lists each absent family once", () => {
    const boxes = [
      { fontFamily: "Gone" },
      { fontFamily: "Full" },
      { fontFamily: "Gone" },
      { fontFamily: "Lost" },
    ];
    expect(missingFamilies(boxes, fonts)).toEqual(["Gone", "Lost"]);
    expect(missingFamilies([{ fontFamily: "Full" }], fonts)).toEqual([]);
  });
});

describe("colour", () => {
  it("accepts the hex forms the renderer accepts", () => {
    for (const ok of ["#fff", "#FFFF", "#c00000", "#c0000080"]) expect(isHexColor(ok)).toBe(true);
    for (const bad of ["", "c00000", "#c0000", "#12345g", "red"])
      expect(isHexColor(bad)).toBe(false);
  });
  it("shows a six-digit value in the picker", () => {
    expect(pickerColor("#C00")).toBe("#cc0000");
    expect(pickerColor("#c0000080")).toBe("#c00000");
  });
});
