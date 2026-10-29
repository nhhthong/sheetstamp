// Checks a background image by its bytes (signature, size in pixels, JPEG end marker) without decoding it.
import {
  LARGE_BACKGROUND_PIXELS,
  MAX_BACKGROUND_BYTES,
  MAX_BACKGROUND_PIXELS,
} from "../../shared/ipc/images";

export type ImageProblem = "not-image" | "too-big" | "too-many-pixels" | "cut-off" | "unreadable";

export type ImageInfo = {
  format: "png" | "jpeg";
  width: number;
  height: number;
  /** Above the warning threshold: accepted, but slow to export. */
  large: boolean;
};

export type ImageCheck = { ok: true; info: ImageInfo } | { ok: false; problem: ImageProblem };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bad = (problem: ImageProblem): ImageCheck => ({ ok: false, problem });

/** Width and height from the IHDR chunk, which must come first. */
function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Width and height from the first start-of-frame segment. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) return null;
    const marker = b[pos + 1] as number;
    if (marker === 0xff) {
      pos++; // fill byte
      continue;
    }
    // Markers without a length: TEM, RSTn, SOI. Reaching SOS or EOI before a frame header means no size.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = view.getUint16(pos + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (pos + 9 > b.length) return null;
      return { height: view.getUint16(pos + 5), width: view.getUint16(pos + 7) };
    }
    pos += 2 + length;
  }
  return null;
}

/** EXIF orientation (1-8) of a JPEG, or 1 when there is none. Values 5-8 swap width and height when drawn. */
function jpegOrientation(b: Uint8Array): number {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 2;
  while (pos + 4 <= b.length && b[pos] === 0xff) {
    const marker = b[pos + 1] as number;
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(pos + 2);
    const start = pos + 4;
    const isExif =
      marker === 0xe1 &&
      length >= 16 &&
      start + 14 <= b.length &&
      String.fromCharCode(...b.subarray(start, start + 4)) === "Exif";
    if (isExif) {
      const tiff = start + 6;
      const little = b[tiff] === 0x49;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > b.length) return 1;
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > b.length) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    pos += 2 + length;
  }
  return 1;
}

/** Applies the limits decided in T-24. The extension is never consulted. */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length > MAX_BACKGROUND_BYTES) return bad("too-big");
  const isPng = PNG_SIGNATURE.every((v, i) => bytes[i] === v);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) return bad("not-image");
  if (isJpeg && !(bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9)) {
    return bad("cut-off");
  }
  const raw = isPng ? pngSize(bytes) : jpegSize(bytes);
  // The engine and the editor draw a JPEG upright, so the size that counts is the oriented one.
  const size =
    raw && !isPng && jpegOrientation(bytes) >= 5 ? { width: raw.height, height: raw.width } : raw;
  if (!size || size.width === 0 || size.height === 0) return bad("unreadable");
  const pixels = size.width * size.height;
  if (pixels > MAX_BACKGROUND_PIXELS) return bad("too-many-pixels");
  return {
    ok: true,
    info: { format: isPng ? "png" : "jpeg", ...size, large: pixels > LARGE_BACKGROUND_PIXELS },
  };
}
