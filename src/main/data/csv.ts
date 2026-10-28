import Papa from "papaparse";
import { DataError } from "./errors";
import { decodeText, type TextEncodingName } from "./encoding";
import { buildTable, type DataTable } from "./table";

/** Semicolons are common in Vietnamese Excel exports, so they are guessed first-class. */
const DELIMITERS = [",", ";", "\t", "|"];

export function readCsv(
  fileName: string,
  bytes: Uint8Array,
  encoding?: TextEncodingName,
): DataTable {
  const decoded = decodeText(bytes, encoding);
  const parsed = Papa.parse<string[]>(decoded.text, {
    delimitersToGuess: DELIMITERS,
    skipEmptyLines: false,
  });
  // Papa reports recoverable problems (quotes, field count) per row; only a missing result is fatal.
  if (!parsed.data) throw new DataError("unreadable");
  return buildTable({ fileName, encoding: decoded.encoding }, parsed.data);
}
