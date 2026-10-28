/** A tag found in a template. `key` is NFC-normalized with delimiters and spaces removed. */
export type TemplateTag = {
  key: string;
  /** The text as written in the file, for example `{{ten}}`. */
  raw: string;
  /** `unsupported` marks loop and condition markers such as `{{#ds}}` and `{{/ds}}`. */
  kind: "field" | "unsupported";
};

export type RenderResult = {
  data: Uint8Array;
  /** Keys that had no value. Their tag text is left visible in the output. */
  missing: string[];
};

/** Fills Word templates. The rest of the app depends on this interface, not on a library. */
export interface TemplateEngine {
  /** Unique tags of the document, in order of first appearance. */
  parseTags(docx: Uint8Array): Promise<TemplateTag[]>;
  /** `values` is keyed by tag key; an empty string is a real value, a missing key is not. */
  render(docx: Uint8Array, values: Readonly<Record<string, string>>): Promise<RenderResult>;
}
