import { stripDiacritics } from "../../shared/text/diacritics";

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

// Bidi controls and zero-width characters make names that look equal but are not (or read backwards).
const INVISIBLE = /[​-‍﻿‪-‮⁦-⁩]/g;

/** Make one name safe on Windows, macOS and Linux. The extension is not part of `name`. */
export function sanitizeName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/\s+/g, " ")
    // Windows drops trailing dots and spaces, which would make two names collide on extraction.
    .replace(/[. ]+$/g, "")
    .replace(/^ +/g, "")
    // A leading dot would make a hidden file on macOS and Linux.
    .replace(/^\.+/, "_");
  // Windows treats `con.txt` like `con`: only the part before the first dot decides.
  const stem = (cleaned.split(".")[0] as string).trimEnd();
  return RESERVED.test(stem) ? `_${cleaned}` : cleaned;
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
  const name = sanitizeName(options.removeDiacritics ? stripDiacritics(raw) : raw);
  return name === "" ? String(options.rowNumber) : name;
}

const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });

const encoder = new TextEncoder();

/**
 * Cut to at most `max` UTF-16 units (and, when given, `maxBytes` UTF-8 bytes) without splitting a letter and its
 * marks. Text that is already short enough is returned without running the segmenter.
 */
export function truncate(text: string, max: number, maxBytes = Number.POSITIVE_INFINITY): string {
  // UTF-8 needs at most 3 bytes per UTF-16 unit, so short text cannot exceed `maxBytes`.
  const bytesFit = text.length * 3 <= maxBytes || encoder.encode(text).length <= maxBytes;
  if (text.length <= max && bytesFit) return text;
  let out = "";
  let bytes = 0;
  for (const { segment } of segmenter.segment(text)) {
    const size = encoder.encode(segment).length;
    if (out.length + segment.length > max || bytes + size > maxBytes) break;
    out += segment;
    bytes += size;
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
  // Next number to try per base name: every smaller number is already taken (`used` only grows), so a run of
  // identical names stays linear instead of restarting at 1 for each of them.
  const nextNumber = new Map<string, number>();
  return rows.map((row) => {
    const base = baseName(pattern, row.values, {
      rowNumber: row.rowNumber,
      removeDiacritics: options.removeDiacritics,
    });
    for (let n = nextNumber.get(base) ?? 1; ; n++) {
      const suffix = n === 1 ? "" : ` (${n})`;
      const stem = truncate(base, max - extension.length - suffix.length);
      const candidate = `${stem}${suffix}${extension}`;
      if (!used.has(key(candidate))) {
        used.add(key(candidate));
        nextNumber.set(base, n + 1);
        return candidate;
      }
    }
  });
}
