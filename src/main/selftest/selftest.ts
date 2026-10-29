import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { type TextBox } from "../../worker/render/types";
import { runBatch, workerFileIn } from "../export/batch";
import { createImageService, imageWorkerFileIn } from "../images/service";
import { makeDocx, paragraph, run, textOf } from "./make-docx";

const ROWS = 12;
const NAMES = Array.from({ length: ROWS }, (_, i) => `Nguyễn Thị Hương ${i + 1}`);

export type SelfTestReport = {
  ok: boolean;
  platform: string;
  packaged: boolean;
  problems: string[];
  word: { written: number; failed: number; firstText: string };
  image: {
    written: number;
    failed: number;
    family: string;
    jpegMagic: boolean;
    previewPng: boolean;
  };
};

/**
 * Runs the real export pipeline (worker pool, Word engine, canvas, ZIP) with a few rows and checks the result.
 * Used on CI against the packaged app on Windows and Ubuntu, so a build that cannot load a native module
 * or a worker from the ASAR archive fails before release.
 */
export async function runSelfTest(
  outFile: string,
  packaged: boolean,
  workerDirectory: string,
): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), "sheetstamp-selftest-"));
  const problems: string[] = [];
  const worker = workerFileIn(workerDirectory);
  try {
    const rows = NAMES.map((ten, i) => ({ rowNumber: i + 1, values: { ten } }));

    const template = await makeDocx({ body: paragraph(run("Xin chào {{t"), run("en}}")) });
    const word = await runBatch(
      {
        init: { kind: "word", template },
        rows,
        pattern: "{{ten}}",
        extension: "docx",
        folder,
        zipName: "word.zip",
        poolSize: 2,
      },
      worker,
    );
    const wordZip = await JSZip.loadAsync(await readFile(word.zipPath));
    const wordNames = Object.keys(wordZip.files);
    const first = await wordZip.file(wordNames[0] as string)?.async("uint8array");
    const firstText = first ? await textOf(first, "word/document.xml") : "";
    if (word.written !== ROWS || word.failed.length > 0)
      problems.push(`word: ${word.written}/${ROWS} written`);
    if (firstText !== `Xin chào ${NAMES[0]}`) problems.push(`word: unexpected text "${firstText}"`);

    // Fonts and the preview render go through the image worker, as the window's calls do.
    const imageService = createImageService(imageWorkerFileIn(workerDirectory), {
      fontFolders: [],
      systemFonts: true,
    });
    const family =
      (await imageService.listFonts()).find((f) => f.styles.includes("normal"))?.family ?? "";
    if (!family) problems.push("image: no installed font family");
    // Loaded here, not at the top: only the self-test may load the canvas library in the main process.
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 800, 300);
    const box: TextBox = {
      field: "ten",
      x: 40,
      y: 40,
      width: 720,
      fontSize: 48,
      fontFamily: family,
      style: "normal",
      color: "#000000",
      align: "left",
      maxLines: 1,
      overflow: "shrink",
    };
    const background = new Uint8Array(canvas.toBuffer("image/png"));
    const preview = await imageService.render({
      background,
      boxes: [box],
      values: { ten: NAMES[0] as string },
    });
    await imageService.close();
    const previewPng = preview.ok && preview.png[0] === 0x89 && preview.png[1] === 0x50;
    if (!previewPng)
      problems.push(`image: preview render failed (${preview.ok ? "bytes" : preview.code})`);
    const image = await runBatch(
      {
        init: {
          kind: "image",
          template: { background, boxes: [box] },
          format: { type: "jpeg", quality: 85 },
        },
        rows,
        pattern: "{{ten}}",
        extension: "jpg",
        folder,
        zipName: "image.zip",
        poolSize: 2,
      },
      worker,
    );
    const imageZip = await JSZip.loadAsync(await readFile(image.zipPath));
    const jpeg = await imageZip.file(Object.keys(imageZip.files)[0] as string)?.async("uint8array");
    const jpegMagic = jpeg?.[0] === 0xff && jpeg?.[1] === 0xd8;
    if (image.written !== ROWS || image.failed.length > 0)
      problems.push(`image: ${image.written}/${ROWS} written`);
    if (!jpegMagic) problems.push("image: output is not a JPEG");

    const report: SelfTestReport = {
      ok: problems.length === 0,
      platform: process.platform,
      packaged,
      problems,
      word: { written: word.written, failed: word.failed.length, firstText },
      image: { written: image.written, failed: image.failed.length, family, jpegMagic, previewPng },
    };
    await writeFile(outFile, JSON.stringify(report, null, 2));
  } catch (error) {
    problems.push(String(error));
    await writeFile(
      outFile,
      JSON.stringify({ ok: false, platform: process.platform, packaged, problems }, null, 2),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
