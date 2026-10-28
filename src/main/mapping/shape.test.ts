import { describe, expect, it } from "vitest";
import { toProfile, toRecord } from "./shape";

describe("mapping shape", () => {
  it("wraps a flat record and unwraps it again", () => {
    const flat = {
      ho_ten: { kind: "column", column: "Họ tên" },
      noi_dung: { kind: "fixed", text: "x" },
      ghi_chu: { kind: "empty" },
    } as const;
    const profile = toProfile(flat);
    expect(profile).toEqual({ version: 1, fields: flat });
    expect(toRecord(profile)).toEqual(flat);
  });
  it("accepts an already wrapped profile", () => {
    const fields = { a: { kind: "empty" } } as const;
    expect(toProfile({ version: 1, fields })).toEqual({ version: 1, fields });
  });
  it("drops invalid entries and tolerates garbage", () => {
    const messy = { a: { kind: "column" }, b: { kind: "nope" }, c: 3, d: { kind: "empty" } };
    expect(toProfile(messy)).toEqual({ version: 1, fields: { d: { kind: "empty" } } });
    expect(toProfile(null)).toEqual({ version: 1, fields: {} });
    expect(toProfile([1])).toEqual({ version: 1, fields: {} });
  });
  it("returns a copy", () => {
    const profile = toProfile({ a: { kind: "empty" } });
    const record = toRecord(profile);
    record.b = { kind: "empty" };
    expect(profile.fields.b).toBeUndefined();
  });
});
