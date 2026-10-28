import { describe, expect, it } from "vitest";
import { stripDiacritics } from "./diacritics";

describe("stripDiacritics", () => {
  it("removes Vietnamese tone and vowel marks", () => {
    expect(stripDiacritics("Nguyễn Văn Ánh Thử việc")).toBe("Nguyen Van Anh Thu viec");
  });

  it("maps đ and Đ, which are letters and not marks", () => {
    expect(stripDiacritics("đường Đặng")).toBe("duong Dang");
  });

  it("gives the same result for NFC and NFD input", () => {
    const nfc = "Hợp đồng Phạm";
    expect(stripDiacritics(nfc.normalize("NFD"))).toBe(stripDiacritics(nfc.normalize("NFC")));
    expect(stripDiacritics(nfc.normalize("NFD"))).toBe("Hop dong Pham");
  });

  it("removes loose combining marks and keeps case and spaces", () => {
    expect(stripDiacritics("é  Ạ")).toBe("e  A");
  });

  it("leaves text without marks unchanged", () => {
    expect(stripDiacritics("Plain 123_-")).toBe("Plain 123_-");
  });
});
