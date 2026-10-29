import { describe, expect, it } from "vitest";
import { dictionaryFields, newField, sampleText } from "./fields";

describe("fields", () => {
  it("lists the dictionary labels with their keys", () => {
    expect(dictionaryFields).toContainEqual({ key: "ho_ten", label: "Họ và tên" });
  });
  it("makes a key from a typed label and refuses an empty one", () => {
    expect(newField("  Số quyết định ", {})).toEqual({
      key: "so_quyet_dinh",
      label: "Số quyết định",
    });
    expect(newField(" ?! ", {})).toBeNull();
  });
  it("reuses the dictionary entry or known field that has the same key", () => {
    expect(newField("họ và tên", {})).toEqual({ key: "ho_va_ten", label: "họ và tên" });
    expect(newField("HỌ TÊN", {})).toEqual({ key: "ho_ten", label: "Họ và tên" });
    expect(newField("Mã số", { ma_so: "Mã số NV" })).toEqual({ key: "ma_so", label: "Mã số NV" });
  });
  it("uses the label as sample text, or the key when the label is unknown", () => {
    expect(sampleText("ho_ten", { ho_ten: "Họ và tên" })).toBe("Họ và tên");
    expect(sampleText("x", {})).toBe("x");
  });
});
