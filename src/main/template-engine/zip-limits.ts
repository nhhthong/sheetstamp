import { inflateRawSync } from "node:zlib";
import { lazy } from "../../shared/i18n";

/** Largest inflated size of one part, and of all parts together. A real .docx stays far below both. */
export const MAX_PART_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

export const zipMessages = lazy(
  {
    tooBig:
      "File Word này giải nén ra quá lớn (hơn 50 MB một phần hoặc 100 MB tổng cộng) nên không được mở. Chọn file khác.",
    unsupported:
      "File Word này dùng định dạng nén không được hỗ trợ. Mở bằng Word, lưu lại thành .docx rồi thử lại.",
  },
  {
    tooBig:
      "This Word file expands to too much data (more than 50 MB for one part or 100 MB in total), so it is not opened. Choose another file.",
    unsupported:
      "This Word file uses a compression format that is not supported. Open it in Word, save it as .docx and try again.",
  },
);

/** The message is Vietnamese and safe to show to the user. */
export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitError";
  }
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_MARK_16 = 0xffff;
const ZIP64_MARK_32 = 0xffffffff;

/**
 * Check a zip before anything inflates it. The sizes come from the central directory, then every entry is
 * inflated once with a hard output cap of its declared size, so a header that lies about a size cannot
 * get past (the inflater stops at the cap). Zip64 archives are refused: a Word file needs none.
 * Throws a ZipLimitError; any other malformed zip is left for the zip reader to report.
 */
export function assertSafeZip(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = bytes.byteLength;
  if (length < 22) return;

  let eocd = -1;
  for (let i = length - 22; i >= Math.max(0, length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return;

  const unsupported = () => new ZipLimitError(zipMessages.unsupported);
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === ZIP64_LOCATOR_SIGNATURE)
    throw unsupported();
  const count = view.getUint16(eocd + 10, true);
  const dirSize = view.getUint32(eocd + 12, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  if (count === ZIP64_MARK_16 || dirSize === ZIP64_MARK_32 || dirOffset === ZIP64_MARK_32)
    throw unsupported();
  if (count > MAX_ENTRIES) throw unsupported();
  if (dirOffset + dirSize > eocd) return;

  let total = 0;
  let cursor = dirOffset;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > length || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const declared = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (compressed === ZIP64_MARK_32 || declared === ZIP64_MARK_32 || localOffset === ZIP64_MARK_32)
      throw unsupported();

    total += declared;
    if (declared > MAX_PART_BYTES || total > MAX_TOTAL_BYTES)
      throw new ZipLimitError(zipMessages.tooBig);

    // Verify the declared size by inflating, capped at it.
    if (localOffset + 30 > length || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE)
      continue;
    const start =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    if (start + compressed > length) continue;
    const data = bytes.subarray(start, start + compressed);
    if (method === 0) {
      if (compressed > declared) throw new ZipLimitError(zipMessages.tooBig);
    } else if (method === 8) {
      try {
        inflateRawSync(data, { maxOutputLength: Math.max(declared, 1) });
      } catch (error) {
        if ((error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE")
          throw new ZipLimitError(zipMessages.tooBig);
        // Corrupt data: the zip reader reports it.
      }
    }
  }
}
