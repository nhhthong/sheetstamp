import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImageJob, ImageReply } from "../../worker/image-job";
import { ImageService, imageWorkerFileIn } from "./service";

const box = {
  field: "ten",
  x: 0,
  y: 0,
  width: 100,
  fontSize: 20,
  fontFamily: "F",
  style: "normal",
  color: "#000000",
  align: "left",
  maxLines: 1,
  overflow: "shrink",
} as const;

/** Only the signature and IHDR of a PNG: enough for the size checks. */
function smallPng(width = 100, height = 100): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

function fake(reply: (job: ImageJob) => Promise<ImageReply>) {
  const jobs: ImageJob[] = [];
  let started = 0;
  let closed = 0;
  const service = new ImageService(() => {
    started++;
    return {
      run: async (job) => {
        jobs.push(job);
        return reply(job);
      },
      terminate: async () => {
        closed++;
      },
    };
  });
  return { service, jobs, counts: () => ({ started, closed }) };
}

describe("ImageService", () => {
  it("starts the worker on first use only, and not for a focus rescan before that", async () => {
    const { service, jobs, counts } = fake(async () => ({ kind: "fonts", families: [] }));
    service.rescanIfStarted();
    expect(counts().started).toBe(0);
    await service.listFonts();
    service.rescanIfStarted();
    expect(counts().started).toBe(1);
    expect(jobs.map((j) => j.kind)).toEqual(["fonts", "fonts"]);
    await service.close();
    expect(counts().closed).toBe(1);
  });

  it("refuses a background that declares a huge canvas before the worker sees it", async () => {
    const worker = fake(async () => ({ kind: "render", ok: true, png: new Uint8Array(1) }));
    const response = await worker.service.render({
      background: smallPng(60000, 60000),
      boxes: [box],
      values: {},
    });
    expect(response).toEqual({ ok: false, code: "bad-background" });
    expect(worker.jobs).toHaveLength(0);
  });

  it("turns a row-level failure into a result and lets a dead worker reject", async () => {
    const failing = fake(async () => ({
      kind: "render",
      ok: false,
      code: "font-missing",
      field: "F",
    }));
    const request = { background: smallPng(), boxes: [box], values: {} };
    expect(await failing.service.render(request)).toEqual({
      ok: false,
      code: "font-missing",
      field: "F",
    });
    const dead = fake(async () => {
      throw new Error("worker-exit-1");
    });
    await expect(dead.service.render(request)).rejects.toThrow("worker-exit-1");
  });
});

// Uses the real worker built by `npm run build`; skipped when the app has not been built.
const WORKER = imageWorkerFileIn(join(import.meta.dirname, "../../../out/main"));

describe.skipIf(!existsSync(WORKER))("ImageService with the built worker", () => {
  it("lists fonts and renders a PNG in a worker thread", async () => {
    const { createImageService } = await import("./service");
    const FONTS = join(import.meta.dirname, "../../../tests/fixtures/fonts");
    process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
    const service = createImageService(WORKER, { fontFolders: [FONTS], systemFonts: false });
    try {
      expect(await service.listFonts()).toEqual([
        { family: "Sheetstamp Test", styles: ["normal", "bold", "italic", "bolditalic"] },
      ]);
      const { createCanvas } = await import("@napi-rs/canvas");
      const canvas = createCanvas(300, 80);
      const background = new Uint8Array(canvas.toBuffer("image/png"));
      const ok = await service.render({
        background,
        boxes: [{ ...box, fontFamily: "Sheetstamp Test" }],
        values: { ten: "Nguyễn" },
      });
      expect(ok.ok && ok.png[1]).toBe(0x50);
      expect(await service.render({ background, boxes: [box], values: {} })).toEqual({
        ok: false,
        code: "font-missing",
        field: "F",
      });
    } finally {
      await service.close();
      delete process.env.DISABLE_SYSTEM_FONTS_LOAD;
    }
  });
});
