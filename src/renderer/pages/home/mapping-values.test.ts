import { describe, expect, it } from "vitest";
import { countUnresolved, isResolved, rowValues } from "./mapping-values";

const columns = ["Họ tên", "Lý do"];

describe("rowValues", () => {
  it("reads cells through the mapping, keeps empty cells empty and marks the rest unmapped", () => {
    const entries = {
      a: { kind: "column", column: "Họ tên" },
      b: { kind: "column", column: "Lý do" },
      c: { kind: "fixed", text: "Họ tên" },
      d: { kind: "empty" },
      e: { kind: "column", column: "Cột đã mất" },
      f: { kind: "fixed", text: "" },
    } as const;
    const { values, unmapped } = rowValues(["a", "b", "c", "d", "e", "f", "g"], entries, columns, [
      "An",
      "",
    ]);
    expect(values).toEqual({ a: "An", b: "", c: "Họ tên", d: "" });
    expect(unmapped).toEqual(["e", "f", "g"]);
  });
  it("treats a short row as empty cells", () => {
    const { values } = rowValues(["a"], { a: { kind: "column", column: "Lý do" } }, columns, ["x"]);
    expect(values).toEqual({ a: "" });
  });
});

describe("resolution", () => {
  it("counts fields with no choice or an unfinished fixed text", () => {
    expect(isResolved(undefined)).toBe(false);
    expect(isResolved({ kind: "fixed", text: "" })).toBe(false);
    expect(isResolved({ kind: "empty" })).toBe(true);
    expect(
      countUnresolved(["a", "b", "c"], { a: { kind: "empty" }, b: { kind: "fixed", text: "" } }),
    ).toBe(2);
  });
});
