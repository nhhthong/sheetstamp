/**
 * The one diacritic stripper: decomposes (NFD), drops combining marks, maps đ and Đ (letters, not marks, so NFD keeps
 * them) to d and D, and recomposes. Case is kept; callers that need lowercase or tidy spaces wrap it.
 */
export function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}
