import { describe, expect, it } from "vitest";
import { fieldKeyOf } from "./field-key";

describe("fieldKeyOf", () => {
  it("drops diacritics, lowercases and joins words with underscores", () => {
    expect(fieldKeyOf("Họ và tên")).toBe("ho_va_ten");
    expect(fieldKeyOf("Đơn vị công tác")).toBe("don_vi_cong_tac");
  });
  it("gives the same key for composed and decomposed text", () => {
    expect(fieldKeyOf("Ngày sinh".normalize("NFD"))).toBe(fieldKeyOf("Ngày sinh".normalize("NFC")));
  });
  it("trims separators and collapses punctuation", () => {
    expect(fieldKeyOf("  --Số CCCD / CMND!  ")).toBe("so_cccd_cmnd");
  });
  it("is empty when nothing usable is left", () => {
    expect(fieldKeyOf("  ?! ")).toBe("");
  });
});
