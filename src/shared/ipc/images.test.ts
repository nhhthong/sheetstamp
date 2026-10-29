import { describe, expect, it } from "vitest";
import { IpcValidationError } from "./define";
import { listFonts, MAX_BACKGROUND_BYTES, render } from "./images";
import { CHANNEL_NAMES } from "./registry";

const box = {
  field: "ten",
  x: 10,
  y: 10.5,
  width: 300,
  fontSize: 32,
  fontFamily: "Sheetstamp Test",
  style: "bold",
  color: "#1a1a1a",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
};
const request = (over: Record<string, unknown> = {}) => ({
  background: new Uint8Array(4),
  boxes: [box],
  values: { ten: "Nguyễn Văn A" },
  ...over,
});
const bad = (over: Record<string, unknown>) => () => render.parse(request(over));

describe("images channels", () => {
  it("are registered", () => {
    expect(CHANNEL_NAMES.has("fonts:list")).toBe(true);
    expect(CHANNEL_NAMES.has("image:render")).toBe(true);
  });

  it("fonts:list takes no argument", () => {
    expect(listFonts.parse(undefined)).toBeUndefined();
    expect(() => listFonts.parse({})).toThrow(IpcValidationError);
  });

  it("image:render accepts a valid request and returns plain data", () => {
    const parsed = render.parse(request());
    expect(parsed.boxes).toEqual([box]);
    expect(parsed.values).toEqual({ ten: "Nguyễn Văn A" });
  });

  it("image:render refuses every bad argument", () => {
    for (const value of [undefined, null, "x", []]) {
      expect(() => render.parse(value)).toThrow(IpcValidationError);
    }
    expect(bad({ background: [1, 2] })).toThrow(/bytes/);
    expect(bad({ background: new Uint8Array(MAX_BACKGROUND_BYTES + 1) })).toThrow(/too large/);
    expect(bad({ boxes: "x" })).toThrow(/array/);
    expect(bad({ boxes: Array.from({ length: 201 }, () => box) })).toThrow(/too many/);
    expect(bad({ values: { ten: 5 } })).toThrow(/string/);
    expect(bad({ values: [] })).toThrow(/object/);
    for (const wrong of [
      { style: "heavy" },
      { align: "justify" },
      { overflow: "clip" },
      { color: "red" },
      { color: "url(x)" },
      { fontFamily: "" },
      { field: "" },
      { x: Number.NaN },
      { y: "1" },
      { width: 0 },
      { fontSize: Number.POSITIVE_INFINITY },
      { maxLines: 1.5 },
      { maxLines: 0 },
    ]) {
      expect(bad({ boxes: [{ ...box, ...wrong }] }), JSON.stringify(wrong)).toThrow(
        IpcValidationError,
      );
    }
  });

  it("drops fields it does not know", () => {
    const parsed = render.parse(request({ boxes: [{ ...box, evil: 1 }], extra: true }));
    expect(parsed.boxes[0]).not.toHaveProperty("evil");
    expect(parsed).not.toHaveProperty("extra");
  });
});
