import { describe, expect, it } from "vitest";
import { labelFor, newField, sampleText } from "./fields";

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
  it("uses the label as sample text, or the key when the label is unknown", () => {
    expect(sampleText("ho_ten", { ho_ten: "Họ và tên" })).toBe("Họ và tên");
    expect(sampleText("x", {})).toBe("x");
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
