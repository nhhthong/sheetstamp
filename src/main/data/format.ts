import { DataError } from "./errors";

export type FileFormat = "csv" | "xlsx";

const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, i) => bytes[i] === byte);

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

/**
 * Decide the format from the extension and the first bytes.
 * An OLE2 header means a legacy `.xls`, whatever the extension says, so a renamed file is caught.
 */
export function detectFormat(name: string, bytes: Uint8Array): FileFormat {
  const extension = extensionOf(name);
  if (extension === "xls" || startsWith(bytes, OLE2)) throw new DataError("xls-unsupported");
  if (extension === "xlsx") {
    if (!startsWith(bytes, ZIP)) throw new DataError("not-a-spreadsheet");
    return "xlsx";
  }
  if (extension === "csv") {
    // A zip container is not text, even when it is named .csv.
    if (startsWith(bytes, ZIP)) throw new DataError("not-a-spreadsheet");
    return "csv";
  }
  throw new DataError("not-a-spreadsheet");
}
