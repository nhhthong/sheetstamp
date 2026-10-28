export type TextEncodingName = "utf-8" | "utf-16le" | "utf-16be" | "windows-1258";

/** Encodings the user can pick in the dropdown. TCVN3 and VNI are not supported. */
export const SELECTABLE_ENCODINGS: readonly TextEncodingName[] = [
  "utf-8",
  "windows-1258",
  "utf-16le",
  "utf-16be",
];

export type Decoded = { text: string; encoding: TextEncodingName };

function bom(bytes: Uint8Array): { encoding: TextEncodingName; skip: number } | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", skip: 3 };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", skip: 2 };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", skip: 2 };
  return undefined;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Order: the user's choice, a byte order mark, strict UTF-8, then Windows-1258.
 * No statistical detector: it failed on short Windows-1258 samples (see prototypes/phase0).
 * The result is NFC-normalized, because Windows-1258 writes most Vietnamese letters as base plus combining mark.
 */
export function decodeText(bytes: Uint8Array, override?: TextEncodingName): Decoded {
  const mark = override ? undefined : bom(bytes);
  const encoding =
    override ?? mark?.encoding ?? (isValidUtf8(bytes) ? "utf-8" : ("windows-1258" as const));
  const body = mark ? bytes.subarray(mark.skip) : bytes;
  const text = new TextDecoder(encoding).decode(body);
  return { text: text.normalize("NFC"), encoding };
}
