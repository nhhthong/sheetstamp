import { describe, expect, it } from "vitest";
import { dictionaryFields, labelFor, newField, sampleText } from "./fields";

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
  it("falls back to the dictionary label for a field picked from the list", () => {
    expect(labelFor("ngay_sinh", {})).toBe("Ngày sinh");
    expect(sampleText("phong_ban", {})).toBe("Phòng ban");
  });
  it("treats a stored label equal to its key as missing (saved by an earlier version)", () => {
    expect(labelFor("chuc_vu", { chuc_vu: "chuc_vu" })).toBe("Chức vụ");
    expect(labelFor("so_x", { so_x: "so_x" })).toBe("so_x");
    expect(labelFor("so_x", { so_x: "Số X" })).toBe("Số X");
  });
  it("prefers the data row's cell over the label when a column matched", () => {
    const labels = { ho_ten: "Họ và tên", don_vi: "Đơn vị" };
    const sample = { ho_ten: "Nguyễn Văn An" };
    expect(sampleText("ho_ten", labels, sample)).toBe("Nguyễn Văn An");
    expect(sampleText("don_vi", labels, sample)).toBe("Đơn vị");
    expect(sampleText("ho_ten", labels, { ho_ten: "" })).toBe("");
  });
});
