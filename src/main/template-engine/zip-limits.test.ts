import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { EasyTemplateXEngine } from "./easy-template-x-engine";
import { assertSafeZip, MAX_PART_BYTES, MAX_TOTAL_BYTES, ZipLimitError } from "./zip-limits";

const MB = 1024 * 1024;

async function zipOf(parts: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(parts)) zip.file(name, data);
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

const bombXml = (size: number) => `<w:document><w:body>${"a".repeat(size)}</w:body></w:document>`;

/** Overwrite the uncompressed size of every central directory record. */
function lieAboutSize(zip: Uint8Array, size: number): Uint8Array {
  const copy = zip.slice();
  const view = new DataView(copy.buffer);
  for (let i = 0; i + 46 < copy.length; i++) {
    if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, size, true);
  }
  return copy;
}

describe("assertSafeZip", () => {
  it("accepts a normal document", async () => {
    assertSafeZip(await zipOf({ "word/document.xml": bombXml(1000) }));
  });

  it("refuses a part over the limit by its declared size, fast, from a few MB", async () => {
    const bomb = await zipOf({ "word/document.xml": bombXml(MAX_PART_BYTES + MB) });
    expect(bomb.length).toBeLessThan(5 * MB);
    const before = process.memoryUsage().arrayBuffers;
    const t = performance.now();
    expect(() => assertSafeZip(bomb)).toThrow(ZipLimitError);
    expect(performance.now() - t).toBeLessThan(200);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(10 * MB);
  });

  it("refuses a total over the limit made of parts under the part limit", async () => {
    const part = bombXml(MAX_PART_BYTES - MB);
    const bomb = await zipOf({
      "word/document.xml": part,
      "word/header1.xml": part,
      "word/footer1.xml": part,
    });
    expect(MAX_TOTAL_BYTES).toBeLessThan(3 * part.length);
    expect(() => assertSafeZip(bomb)).toThrow(ZipLimitError);
  }, 60_000);

  it("refuses a header that lies about a small size", async () => {
    const real = await zipOf({ "word/document.xml": bombXml(MAX_PART_BYTES + MB) });
    const lying = lieAboutSize(real, 1000);
    const before = process.memoryUsage().arrayBuffers;
    expect(() => assertSafeZip(lying)).toThrow(ZipLimitError);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(10 * MB);
  });

  it("refuses zip64", async () => {
    const zip = await zipOf({ "word/document.xml": "<w:document/>" });
    // A zip64 end-of-directory locator right before the end record.
    const eocd = zip.length - 22;
    const locator = new Uint8Array(20);
    new DataView(locator.buffer).setUint32(0, 0x07064b50, true);
    const withLocator = new Uint8Array(zip.length + 20);
    withLocator.set(zip.subarray(0, eocd));
    withLocator.set(locator, eocd);
    withLocator.set(zip.subarray(eocd), eocd + 20);
    expect(() => assertSafeZip(withLocator)).toThrow(ZipLimitError);
    // 0xFFFFFFFF marks in a record
    expect(() => assertSafeZip(lieAboutSize(zip, 0xffffffff))).toThrow(ZipLimitError);
  });

  it("leaves non-zip bytes to the zip reader", () => {
    expect(() => assertSafeZip(new Uint8Array(100))).not.toThrow();
    expect(() => assertSafeZip(new Uint8Array(3))).not.toThrow();
  });
});

describe("engine on a bomb", () => {
  it("refuses parseTags and render before inflating", async () => {
    const bomb = await zipOf({ "word/document.xml": bombXml(MAX_PART_BYTES + MB) });
    const engine = new EasyTemplateXEngine();
    await expect(engine.parseTags(bomb)).rejects.toBeInstanceOf(ZipLimitError);
    await expect(engine.render(bomb, {})).rejects.toBeInstanceOf(ZipLimitError);
    const lying = lieAboutSize(bomb, 100);
    await expect(new EasyTemplateXEngine().parseTags(lying)).rejects.toBeInstanceOf(ZipLimitError);
  });
});
