/** A filename pattern such as `{{ten}}_Thử việc`: fixed text and `{{field}}` tags. */
export type PatternPart = { type: "text"; value: string } | { type: "field"; key: string };

export type PatternProblem =
  | { kind: "empty" }
  | { kind: "path-characters"; text: string }
  | { kind: "unknown-field"; key: string };

const TAG = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function parsePattern(pattern: string): PatternPart[] {
  const parts: PatternPart[] = [];
  let last = 0;
  for (const match of pattern.matchAll(TAG)) {
    if (match.index > last) parts.push({ type: "text", value: pattern.slice(last, match.index) });
    parts.push({ type: "field", key: (match[1] as string).normalize("NFC") });
    last = match.index + match[0].length;
  }
  if (last < pattern.length) parts.push({ type: "text", value: pattern.slice(last) });
  return parts;
}

/**
 * Fixed text typed by the user must not reach into other folders: `/`, `\` and `..` are rejected.
 * (Values coming from the data are sanitized instead, so one odd cell does not fail a row.)
 */
export function validatePattern(pattern: string, knownKeys: readonly string[]): PatternProblem[] {
  const problems: PatternProblem[] = [];
  const parts = parsePattern(pattern);
  if (parts.length === 0 || pattern.trim() === "") return [{ kind: "empty" }];
  const known = new Set(knownKeys.map((key) => key.normalize("NFC")));
  for (const part of parts) {
    if (part.type === "text" && /[\\/]|\.\./.test(part.value)) {
      problems.push({ kind: "path-characters", text: part.value });
    }
    if (part.type === "field" && !known.has(part.key)) {
      problems.push({ kind: "unknown-field", key: part.key });
    }
  }
  return problems;
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function removeDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

/** Make one name safe on Windows, macOS and Linux. The extension is not part of `name`. */
export function sanitizeName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/\s+/g, " ")
    // Windows drops trailing dots and spaces, which would make two names collide on extraction.
    .replace(/[. ]+$/g, "")
    .replace(/^ +/g, "");
  return RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
}

export type NameOptions = {
  extension: string;
  /** 1-based number of the data row, used when the pattern gives an empty name. */
  rowNumber: number;
  removeDiacritics?: boolean;
};

/** Name without the extension, before truncation and duplicate handling. */
export function baseName(
  pattern: string,
  values: Readonly<Record<string, string>>,
  options: Pick<NameOptions, "rowNumber" | "removeDiacritics">,
): string {
  const lookup = new Map(Object.entries(values).map(([k, v]) => [k.normalize("NFC"), v]));
  const raw = parsePattern(pattern)
    .map((part) => (part.type === "text" ? part.value : (lookup.get(part.key) ?? "")))
    .join("");
  const name = sanitizeName(options.removeDiacritics ? removeDiacritics(raw) : raw);
  return name === "" ? String(options.rowNumber) : name;
}

const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });

/** Cut to at most `max` UTF-16 units without splitting a letter and its marks. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (out.length + segment.length > max) break;
    out += segment;
  }
  return out.replace(/[. ]+$/g, "");
}

/**
 * Longest file name (with extension) that keeps `<folder>\<zip name>\<file>` within Windows' 260 characters,
 * the layout Explorer's "Extract All" produces next to the ZIP. Never less than 24.
 */
export function maxNameLength(destinationFolder: string, zipBaseName: string): number {
  const budget = 259 - destinationFolder.length - 1 - zipBaseName.length - 1;
  return Math.max(24, budget);
}

const key = (name: string) => name.normalize("NFC").toLowerCase();

/** One unique file name per row. Duplicates are compared without case, after NFC. */
export function planFileNames(
  rows: ReadonlyArray<{ rowNumber: number; values: Readonly<Record<string, string>> }>,
  pattern: string,
  options: { extension: string; removeDiacritics?: boolean; maxLength?: number },
): string[] {
  const extension = options.extension.startsWith(".") ? options.extension : `.${options.extension}`;
  const max = options.maxLength ?? 200;
  const used = new Set<string>();
  return rows.map((row) => {
    const base = baseName(pattern, row.values, {
      rowNumber: row.rowNumber,
      removeDiacritics: options.removeDiacritics,
    });
    for (let n = 1; ; n++) {
      const suffix = n === 1 ? "" : ` (${n})`;
      const stem = truncate(base, max - extension.length - suffix.length);
      const candidate = `${stem}${suffix}${extension}`;
      if (!used.has(key(candidate))) {
        used.add(key(candidate));
        return candidate;
      }
    }
  });
}
