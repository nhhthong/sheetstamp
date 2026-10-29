import { describe, expect, it } from "vitest";
import { suggest } from "./FieldPicker";

const options = [
  { key: "ho_ten", label: "Họ và tên" },
  { key: "ngay_sinh", label: "Ngày sinh" },
  { key: "ngay_cap", label: "Ngày cấp" },
  { key: "phong_ban", label: "Phòng ban" },
  { key: "chuc_vu", label: "Chức vụ" },
  { key: "so_hop_dong", label: "Số hợp đồng" },
];

describe("suggest", () => {
  it("lists nothing until something is typed", () => {
    expect(suggest(options, "")).toEqual([]);
    expect(suggest(options, "   ")).toEqual([]);
  });
  it("matches without diacritics or case, on the label and on the key", () => {
    expect(suggest(options, "ngay").map((o) => o.key)).toEqual(["ngay_sinh", "ngay_cap"]);
    expect(suggest(options, "NGÀY S").map((o) => o.key)).toEqual(["ngay_sinh"]);
    expect(suggest(options, "ho_ten").map((o) => o.key)).toEqual(["ho_ten"]);
  });
  it("puts names that start with the text before names that only contain it", () => {
    // "Họ và tên" starts with it, "Số hợp đồng" has a word that does, "Phòng ban" only contains it.
    expect(suggest(options, "ho").map((o) => o.key)).toEqual([
      "ho_ten",
      "so_hop_dong",
      "phong_ban",
    ]);
  });
  it("never returns more than six, and nothing for a text no field has", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: `ngay_${i}`, label: `Ngày ${i}` }));
    expect(suggest(many, "ngay")).toHaveLength(6);
    expect(suggest(options, "zzz")).toEqual([]);
  });
});
