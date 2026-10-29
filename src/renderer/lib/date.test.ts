import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../../shared/i18n";
import { formatDate, formatIsoDay } from "./date";

afterEach(() => setLang("vi"));

describe("dates", () => {
  it("writes a day the Vietnamese way", () => {
    setLang("vi");
    expect(formatIsoDay("2027-04-27")).toBe("27/04/2027");
    expect(formatDate("2026-10-29T08:05:00Z")).toMatch(/29\/10\/2026/);
  });
  it("writes the month in words in English", () => {
    setLang("en");
    expect(formatIsoDay("2027-04-27")).toBe("27 April 2027");
    expect(formatDate("2026-10-29T08:05:00Z")).toBe("29 Oct 2026");
  });
});
