import { getLang } from "../../shared/i18n";

/** A stored timestamp as a day: "29/10/2026" in Vietnamese, "29 Oct 2026" in English (no ambiguous dd/mm). */
export function formatDate(iso: string): string {
  const day = new Date(iso);
  return getLang() === "vi"
    ? day.toLocaleDateString("vi-VN")
    : day.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A date-only "YYYY-MM-DD": "27/04/2027" in Vietnamese, "27 April 2027" in English. */
export function formatIsoDay(iso: string): string {
  if (getLang() === "vi") return iso.split("-").reverse().join("/");
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
