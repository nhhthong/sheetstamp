import { describe, expect, it } from "vitest";
import { emptyImageLayout, parseImageLayout } from "./index";

const box = {
  id: "b1",
  field: "ten",
  x: 10,
  y: 20,
  width: 300,
  fontSize: 40,
  fontFamily: "Test Sans",
  style: "bold",
  color: "#112233",
  align: "center",
  maxLines: 2,
  overflow: "shrink",
};

describe("parseImageLayout", () => {
  it("accepts the empty layout and a layout with boxes", () => {
    expect(parseImageLayout(emptyImageLayout())).toEqual({ ok: true, layout: emptyImageLayout() });
    expect(parseImageLayout({ version: 1, boxes: [box] })).toEqual({
      ok: true,
      layout: { version: 1, boxes: [box] },
    });
  });

  it("refuses a newer version without reading its boxes", () => {
    expect(parseImageLayout({ version: 2, boxes: "anything" })).toEqual({
      ok: false,
      reason: "newer",
    });
  });

  it.each([
    ["null", null],
    ["a string", "x"],
    ["an array", []],
    ["no version", { boxes: [] }],
    ["version 0", { version: 0, boxes: [] }],
    ["a fractional version", { version: 1.5, boxes: [] }],
    ["boxes missing", { version: 1 }],
    ["a box without id", { version: 1, boxes: [{ ...box, id: undefined }] }],
    ["an empty id", { version: 1, boxes: [{ ...box, id: "" }] }],
    ["a duplicate id", { version: 1, boxes: [box, box] }],
    ["a bad colour", { version: 1, boxes: [{ ...box, color: "red" }] }],
    ["a bad style", { version: 1, boxes: [{ ...box, style: "heavy" }] }],
    ["a zero width", { version: 1, boxes: [{ ...box, width: 0 }] }],
  ])("marks %s as invalid", (_name, value) => {
    expect(parseImageLayout(value)).toEqual({ ok: false, reason: "invalid" });
  });
});
