import { describe, expect, it } from "vitest";
import { parseImageLayout } from "../../../../shared/image-layout";
import { newBox } from "./new-box";

const defaults = { imageWidth: 1000, imageHeight: 800, fontFamily: "Test Sans" };

describe("newBox", () => {
  it("sizes the font from the image height and keeps the box inside the image", () => {
    const box = newBox("ho_ten", 0, defaults, "b1");
    expect(box.fontSize).toBe(40);
    expect(box.x + box.width).toBeLessThanOrEqual(1000);
    expect(box.y + box.fontSize).toBeLessThanOrEqual(800);
  });
  it("shifts each new box down and never past the bottom", () => {
    expect(newBox("a", 1, defaults, "b").y).toBeGreaterThan(newBox("a", 0, defaults, "b").y);
    expect(newBox("a", 500, defaults, "b").y).toBeLessThanOrEqual(800);
  });
  it("is a valid stored box even for a tiny image", () => {
    const box = newBox("ten", 0, { imageWidth: 3, imageHeight: 2, fontFamily: "x" }, "b1");
    expect(parseImageLayout({ version: 1, boxes: [box] }).ok).toBe(true);
  });
});
