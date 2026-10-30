import { describe, expect, it } from "vitest";
import { labelFor, newField } from "./fields";

describe("fields", () => {
  it("makes a key from a typed label and refuses an empty one", () => {
    expect(newField("  Số quyết định ", {})).toEqual({
      key: "so_quyet_dinh",
      label: "Số quyết định",
    });
    expect(newField(" ?! ", {})).toBeNull();
  });
  it("reuses a known field that has the same key", () => {
    expect(newField("HỌ TÊN", {})).toEqual({ key: "ho_ten", label: "HỌ TÊN" });
    expect(newField("Mã số", { ma_so: "Mã số NV" })).toEqual({ key: "ma_so", label: "Mã số NV" });
  });
  it("shows the label of a field, or its key when the label is unknown", () => {
    expect(labelFor("ho_ten", { ho_ten: "Họ và tên" })).toBe("Họ và tên");
    expect(labelFor("x", {})).toBe("x");
  });
});
