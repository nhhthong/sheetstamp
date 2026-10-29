import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LANG, getLang, isLang, lazy, pick, setLang, t } from "./i18n";

afterEach(() => setLang("vi"));

describe("i18n", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LANG).toBe("en");
    setLang(DEFAULT_LANG);
    expect(getLang()).toBe("en");
    expect(t("Xin chào", "Hello")).toBe("Hello");
  });
  it("reads a lazy table in the language in force at each read", () => {
    const messages = lazy({ hi: "Xin chào" }, { hi: "Hello" });
    setLang("en");
    expect(messages.hi).toBe("Hello");
    setLang("vi");
    expect(messages.hi).toBe("Xin chào");
  });
  it("follows setLang", () => {
    setLang("vi");
    expect(t("Xin chào", "Hello")).toBe("Xin chào");
    expect(pick({ a: "đ" }, { a: "d" })).toEqual({ a: "đ" });
  });
  it("accepts only the two languages", () => {
    expect(isLang("vi")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
