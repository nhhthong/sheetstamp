import { describe, expect, it } from "vitest";
import { MAX_BACKGROUND_BYTES } from "../../shared/ipc/images";
import { checkImage } from "./image-file";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

/** SOI, an APP0 segment, SOF0, then end marker (or not). */
function jpeg(width: number, height: number, end = true): Uint8Array {
  const out = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  out.push(0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 255, width >> 8, width & 255, 1);
  out.push(0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x02, 0x12, 0x34);
  if (end) out.push(0xff, 0xd9);
  return Uint8Array.from(out);
}

describe("checkImage", () => {
  it("reads PNG and JPEG sizes from the headers", () => {
    expect(checkImage(png(1600, 1000))).toEqual({
      ok: true,
      info: { format: "png", width: 1600, height: 1000, large: false },
    });
    expect(checkImage(jpeg(300, 200))).toEqual({
      ok: true,
      info: { format: "jpeg", width: 300, height: 200, large: false },
    });
  });

  it("warns above 4 MP and refuses above 25 MP", () => {
    expect(checkImage(png(2001, 2000))).toMatchObject({ ok: true, info: { large: true } });
    expect(checkImage(png(4000, 4000))).toMatchObject({ ok: true, info: { large: true } });
    expect(checkImage(png(6000, 4000))).toMatchObject({ ok: true, info: { large: true } });
    expect(checkImage(png(5001, 5000))).toEqual({ ok: false, problem: "too-many-pixels" });
    expect(checkImage(jpeg(6001, 5000))).toEqual({ ok: false, problem: "too-many-pixels" });
  });

  it("rejects other formats by content", () => {
    const gif = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
    expect(checkImage(gif)).toEqual({ ok: false, problem: "not-image" });
    expect(checkImage(new Uint8Array(0))).toEqual({ ok: false, problem: "not-image" });
  });

  it("rejects a JPEG without the end marker as cut off", () => {
    expect(checkImage(jpeg(300, 200, false))).toEqual({ ok: false, problem: "cut-off" });
  });

  it("rejects a file over 20 MB", () => {
    const big = new Uint8Array(MAX_BACKGROUND_BYTES + 1);
    big.set(png(10, 10));
    expect(checkImage(big)).toEqual({ ok: false, problem: "too-big" });
  });

  it("rejects a signature without a readable header", () => {
    expect(checkImage(png(10, 10).slice(0, 20))).toEqual({ ok: false, problem: "unreadable" });
    expect(checkImage(png(0, 10))).toEqual({ ok: false, problem: "unreadable" });
    expect(checkImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toEqual({
      ok: false,
      problem: "unreadable",
    });
  });
});
