// IPC channels of the "preview" feature, handled in src/main/ipc/preview.ts.
import { arrayOf, bytes, channel, IpcValidationError, record, string } from "./define";

/**
 * Private-use characters that wrap each value in the preview copy of the document. They are never written to
 * an exported file: export fills the template through another path with the real values.
 */
export const MARK_OPEN = "";
export const MARK_CLOSE = "";
/** First character inside a marked pair when the tag has no value at all (not mapped to a column). */
export const MARK_MISSING = "";
export const MARKER_PATTERN = /[-]/g;

export const MAX_TEMPLATE_BYTES = 50 * 1024 * 1024;

export type PreviewRequest = {
  /** The template file. */
  docx: Uint8Array;
  /** The row's values keyed by tag key. An empty string is a real (empty) value. */
  values: Record<string, string>;
  /** Tag keys with no column mapped to them. A tag absent from `values` counts as unmapped too. */
  unmapped: string[];
};

export type PreviewResponse = {
  /** The template filled with each value between MARK_OPEN and MARK_CLOSE. */
  docx: Uint8Array;
  /** The same content as plain text, for a document that cannot be drawn. */
  text: string;
};

function parsePreviewRequest(value: unknown): PreviewRequest {
  const request = record(value);
  const rawValues = record(request.values, "values");
  const keys = Object.keys(rawValues);
  if (keys.length > 5000) throw new IpcValidationError("values has too many items");
  const values: Record<string, string> = {};
  for (const key of keys) values[key] = string(rawValues[key], `value of ${key}`, { max: 100_000 });
  return {
    docx: bytes(request.docx, "docx", MAX_TEMPLATE_BYTES),
    values,
    unmapped: arrayOf(
      request.unmapped,
      "unmapped",
      (v) => string(v, "unmapped key", { max: 1000 }),
      5000,
    ),
  };
}

export const fill = channel<PreviewRequest, PreviewResponse>("preview:fill", parsePreviewRequest);

export const channels = [fill] as const;
export const events = [] as const;
