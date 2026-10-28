// Spike T-2: does @napi-rs/canvas run in a worker thread and in an Electron utility process,
// in the packaged app? Removed once the decision is recorded.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { workerData, parentPort as workerPort } from "node:worker_threads";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

type Style = { name: string; font: (family: string) => string };
const STYLES: Style[] = [
  { name: "normal", font: (f) => `32px "${f}"` },
  { name: "bold", font: (f) => `bold 32px "${f}"` },
  { name: "italic", font: (f) => `italic 32px "${f}"` },
  { name: "bolditalic", font: (f) => `italic bold 32px "${f}"` },
];
const TEXT = "Nguyễn Thị Hương ệ ẫ ộ Đ";

function run(fontDir: string) {
  const started = performance.now();
  const registered = ["Regular", "Bold", "Italic", "BoldItalic"].map((face) =>
    Boolean(GlobalFonts.registerFromPath(join(fontDir, `SheetstampTest-${face}.ttf`))),
  );
  const families = GlobalFonts.families;
  const faces = STYLES.map((style) => {
    const canvas = createCanvas(640, 80);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 640, 80);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "top";
    ctx.font = style.font("Sheetstamp Test");
    ctx.fillText(TEXT, 10, 10);
    const pixels = ctx.getImageData(0, 0, 640, 80).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if ((pixels[i] as number) < 128) dark++;
    const png = canvas.toBuffer("image/png");
    return {
      style: style.name,
      darkPixels: dark,
      pngBytes: png.length,
      hash: createHash("sha1").update(png).digest("hex").slice(0, 12),
    };
  });
  return {
    registered,
    familyCount: families.length,
    testFamilyStyles: families.find((f) => f.family === "Sheetstamp Test")?.styles.length ?? 0,
    faces,
    ms: Math.round(performance.now() - started),
  };
}

/** Does a font installed while the process runs show up after `loadFontsFromDir()` on the font folder? */
function systemFontsProbe(fontDir: string) {
  const has = () => GlobalFonts.families.some((f) => f.family === "Sheetstamp Test");
  const before = { families: GlobalFonts.families.length, hasTest: has() };
  const target =
    process.platform === "win32"
      ? join(
          process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local"),
          "Microsoft/Windows/Fonts",
        )
      : join(homedir(), ".local/share/fonts");
  mkdirSync(target, { recursive: true });
  copyFileSync(
    join(fontDir, "SheetstampTest-Regular.ttf"),
    join(target, "SheetstampTest-Regular.ttf"),
  );
  const loaded = GlobalFonts.loadFontsFromDir(target);
  const after = { families: GlobalFonts.families.length, hasTest: has(), newlyLoaded: loaded };
  return { target, before, after };
}

function main() {
  try {
    if (workerPort) {
      workerPort.postMessage({ ok: true, result: run(workerData.fontDir as string) });
    } else {
      const port = (process as unknown as { parentPort: { postMessage(m: unknown): void } })
        .parentPort;
      port.postMessage({
        ok: true,
        result:
          process.argv[3] === "system"
            ? systemFontsProbe(process.argv[2] as string)
            : run(process.argv[2] as string),
      });
    }
  } catch (error) {
    const message = { ok: false, error: String(error) };
    if (workerPort) workerPort.postMessage(message);
    else
      (
        process as unknown as { parentPort: { postMessage(m: unknown): void } }
      ).parentPort.postMessage(message);
  }
}

main();
