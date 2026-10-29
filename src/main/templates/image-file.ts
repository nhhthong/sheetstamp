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

/** Applies the limits decided in T-24. The extension is never consulted. */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length > MAX_BACKGROUND_BYTES) return bad("too-big");
  const isPng = PNG_SIGNATURE.every((v, i) => bytes[i] === v);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) return bad("not-image");
  if (isJpeg && !(bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9)) {
    return bad("cut-off");
  }
  const size = isPng ? pngSize(bytes) : jpegSize(bytes);
  if (!size || size.width === 0 || size.height === 0) return bad("unreadable");
  const pixels = size.width * size.height;
  if (pixels > MAX_BACKGROUND_PIXELS) return bad("too-many-pixels");
  return {
    ok: true,
    info: { format: isPng ? "png" : "jpeg", ...size, large: pixels > LARGE_BACKGROUND_PIXELS },
  };
}
