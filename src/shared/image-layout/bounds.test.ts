import { describe, expect, it } from "vitest";
import { boxFit } from "./bounds";

const box = (x: number, y: number, width = 100) => ({ x, y, width, fontSize: 20, maxLines: 2 });

describe("boxFit", () => {
  it("is inside when the whole box area is on the image, edges included", () => {
    expect(boxFit(box(0, 0), 100, 50)).toBe("inside");
    expect(boxFit(box(10, 10, 50), 100, 60)).toBe("inside");
  });
  it("is partly when any edge crosses the image", () => {
    expect(boxFit(box(1, 0), 100, 50)).toBe("partly");
    expect(boxFit(box(0, 1), 100, 50)).toBe("partly");
    expect(boxFit(box(-5, 0), 100, 50)).toBe("partly");
    expect(boxFit(box(0, -5), 100, 50)).toBe("partly");
  });
  it("is outside when no part of the box area is on the image", () => {
    expect(boxFit(box(100, 0), 100, 50)).toBe("outside");
    expect(boxFit(box(0, 50), 100, 50)).toBe("outside");
    expect(boxFit(box(-100, 0), 100, 50)).toBe("outside");
    expect(boxFit(box(0, -50), 100, 50)).toBe("outside");
  });
});
