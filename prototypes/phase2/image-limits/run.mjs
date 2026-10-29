// Spike T-24: which background images can the image engine take? Measures the real render path
// (out/main/generate-worker.js -> createGenerator -> renderImage, driven by runBatch's WorkerPool).
// Run `npm run build` first, then: node prototypes/phase2/image-limits/run.mjs [--quick] [--no-full] [--write]
//   --write    also save the output to prototypes/phase2/image-limits/output.md
//   --quick    fewer rows per size (about 1 minute)
//   --no-full  skip the 4,000-row run at 1600x1000
// Fixtures (EXIF, CMYK, ...) are committed in ./fixtures; `python3 make-fixtures.py` recreates them (needs Pillow).
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { availableParallelism, cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { runBatch, workerFileIn } from "../../../out/main/batch.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const WORKER = workerFileIn(fileURLToPath(new URL("../../../out/main", import.meta.url)));
const QUICK = process.argv.includes("--quick");
const FAMILY =
  GlobalFonts.families.find((f) => f.family === "Liberation Sans")?.family ??
  GlobalFonts.families[0]?.family;

// ---------- generated backgrounds (no downloads) ----------
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
/** A photo-ish background: gradient plus many translucent blobs (so JPEG/PNG sizes are realistic, not tiny). */
function makeBackground(width, height, type, quality = 85) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#fdf6e3");
  g.addColorStop(1, "#d6e4f0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0},0.15)`;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, (0.02 + rnd() * 0.1) * width, 0, Math.PI * 2);
    ctx.fill();
  }
  return type === "png" ? canvas.toBuffer("image/png") : canvas.toBuffer("image/jpeg", quality);
}
/** Worst case for bytes: per-pixel noise does not compress. */
function makeNoise(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const data = ctx.createImageData(width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = (rnd() * 256) | 0;
    data.data[i + 1] = (rnd() * 256) | 0;
    data.data[i + 2] = (rnd() * 256) | 0;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toBuffer("image/png");
}

const box = (w, field, y, size, style) => ({
  field,
  x: Math.round(w * 0.0625),
  y: Math.round(w * y),
  width: Math.round(w * 0.875),
  fontSize: Math.round(w * size),
  fontFamily: FAMILY,
  style,
  color: "#1a1a1a",
  align: "center",
  maxLines: 1,
  overflow: "shrink",
});
/** Same 4 text boxes as the Phase 0 benchmark, scaled to the image width. */
const boxesFor = (w) => [
  box(w, "ten", 0.1875, 0.06, "bold"),
  box(w, "phong_ban", 0.2875, 0.03, "normal"),
  box(w, "dia_chi", 0.35, 0.025, "italic"),
  box(w, "so_hop_dong", 0.5, 0.0225, "normal"),
];
const rows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    rowNumber: i + 1,
    values: {
      ten: `Nguyễn Văn ${i} Đặng`,
      phong_ban: "Kế toán",
      dia_chi: `Số ${i} đường Lê Lợi, Quận 1, Thành phố Hồ Chí Minh`,
      so_hop_dong: `HD-${i}`,
    },
  }));

// ---------- timing through the real pool ----------
async function batch(background, w, rowCount, poolSize, format) {
  const folder = await mkdtemp(join(tmpdir(), "sheetstamp-imglimits-"));
  const base = process.memoryUsage().rss;
  let peak = base;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 50);
  const t0 = performance.now();
  let result;
  let error;
  try {
    result = await runBatch(
      {
        init: { kind: "image", format, template: { background: new Uint8Array(background), boxes: boxesFor(w) } },
        rows: rows(rowCount),
        pattern: "{{so_hop_dong}}",
        extension: format.type === "png" ? "png" : "jpg",
        folder,
        zipName: "out.zip",
        poolSize,
      },
      WORKER,
    );
  } catch (e) {
    error = String(e?.message ?? e);
  }
  const seconds = (performance.now() - t0) / 1000;
  clearInterval(sampler);
  const zip = result ? (await stat(result.zipPath)).size : 0;
  await rm(folder, { recursive: true, force: true });
  return {
    seconds,
    written: result?.written ?? 0,
    failed: result?.failed?.length ?? rowCount,
    error,
    peakMb: peak / 1e6,
    baseMb: base / 1e6,
    outKb: result && result.written ? zip / result.written / 1e3 : 0,
  };
}

const fmt = (n, d = 1) => n.toFixed(d);
const out = [];
const say = (line = "") => {
  out.push(line);
  console.log(line);
};

say("# Spike T-24: image background limits (raw run output)");
say(`Machine: ${cpus()[0]?.model}, ${availableParallelism()} cores; Node ${process.version}; font ${FAMILY}`);
say(`Pool = the real WorkerPool + src/worker/generate-worker (built); 4 text boxes scaled from the Phase 0 certificate.`);
say();

// ---------- A. size table ----------
const sizes = [
  { w: 1600, h: 1000, n1: 24, n3: 300 },
  { w: 3000, h: 2000, n1: 8, n3: 90 },
  { w: 6000, h: 4000, n1: 3, n3: 30 },
];
say("## A. Time and memory by pixel size (photo-like JPEG q85 background, JPEG q85 output)");
say("1 worker = pure per-image time (includes ZIP write). 3 workers = default pool on 4 cores (cores minus one).");
say("4,000 rows is extrapolated from the marginal 3-worker cost (two batch sizes, difference / rows). Peak MB = peak process RSS (all worker threads included).");
say();
say("| Size | MP | Background KB | 1 worker s/img | 3 workers s/img (marginal) | Peak RSS MB (3 workers) | 4,000 rows est. s | Failed |");
say("|---|---|---|---|---|---|---|---|");
const perImage = {};
for (const { w, h, n1, n3 } of sizes) {
  const bg = makeBackground(w, h, "jpeg");
  const f = { type: "jpeg", quality: 85 };
  await batch(bg, w, 3, 3, f); // warm-up (fonts, JIT), not reported
  const one = await batch(bg, w, QUICK ? Math.ceil(n1 / 2) : n1, 1, f);
  const rowsDone = QUICK ? Math.ceil(n3 / 3) : n3;
  const half = await batch(bg, w, rowsDone, 3, f);
  const three = await batch(bg, w, rowsDone * 2, 3, f);
  // Marginal cost per row: the difference between two batch sizes cancels pool start-up and ZIP set-up.
  const marginal = (three.seconds - half.seconds) / rowsDone;
  const est = marginal * 4000;
  perImage[`${w}x${h}`] = { one: one.seconds / Math.max(1, one.written), est };
  say(
    `| ${w}x${h} | ${fmt((w * h) / 1e6)} | ${fmt(bg.length / 1e3, 0)} | ${fmt(one.seconds / Math.max(1, one.written), 3)} | ${fmt(marginal, 3)} | ${fmt(three.peakMb, 0)} | ${fmt(est, 0)} | ${one.failed + three.failed} ${one.error ?? three.error ?? ""} |`,
  );
}
say();

// ---------- B. output format ----------
say("## B. Output format at the same pixel size (1 worker, s per image)");
say();
say("| Size | Background | Output JPEG q85 | Output PNG | PNG output KB/img |");
say("|---|---|---|---|---|");
for (const { w, h } of sizes.slice(0, 2)) {
  for (const type of ["jpeg", "png"]) {
    const bg = makeBackground(w, h, type);
    const n = w > 2000 ? 6 : 16;
    await batch(bg, w, 2, 1, { type: "png" });
    const j = await batch(bg, w, n, 1, { type: "jpeg", quality: 85 });
    const p = await batch(bg, w, n, 1, { type: "png" });
    say(`| ${w}x${h} | ${type} (${fmt(bg.length / 1e3, 0)} KB) | ${fmt(j.seconds / n, 3)} | ${fmt(p.seconds / n, 3)} | ${fmt(p.outKb, 0)} |`);
  }
}
say();

// ---------- C. bytes vs pixels, and a probe beyond the table ----------
say("## C. Bytes against pixels, and probes beyond 6000x4000");
say();
say("| Case | Background MB | MP | s/img (1 worker) | Peak RSS MB (3 workers) | Result |");
say("|---|---|---|---|---|---|");
{
  const noise = makeNoise(1600, 1000); // incompressible PNG: most bytes per pixel
  const one = await batch(noise, 1600, 12, 1, { type: "png" });
  const three = await batch(noise, 1600, 24, 3, { type: "png" });
  say(`| 1600x1000 noise PNG (incompressible) | ${fmt(noise.length / 1e6)} | 1.6 | ${fmt(one.seconds / 12, 3)} | ${fmt(three.peakMb, 0)} | ${three.failed + one.failed} failed |`);
}
for (const [w, h] of QUICK ? [[8000, 6000]] : [[8000, 6000], [12000, 8000]]) {
  const bg = makeBackground(w, h, "jpeg", 80);
  const one = await batch(bg, w, 2, 1, { type: "jpeg", quality: 85 });
  const three = w > 10000 ? one : await batch(bg, w, 6, 3, { type: "jpeg", quality: 85 }); // 12000x8000: 1 worker only, to stay inside RAM
  say(`| ${w}x${h} photo JPEG | ${fmt(bg.length / 1e6)} | ${fmt((w * h) / 1e6)} | ${fmt(one.seconds / Math.max(1, one.written), 2)} | ${fmt(three.peakMb, 0)} | ${one.failed + three.failed} failed ${one.error ?? three.error ?? ""} |`);
}
say();

// ---------- D. variants, one image through a real worker ----------
function renderOnce(background, format = { type: "png" }) {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER, { workerData: { kind: "image", format, template: { background: new Uint8Array(background), boxes: [] } } });
    worker.once("message", (m) => {
      worker.terminate();
      resolve(m.ok ? { ok: true, data: Buffer.from(m.result) } : { ok: false, code: m.code });
    });
    worker.once("error", (e) => resolve({ ok: false, code: `thread-error ${e.message}` }));
    worker.postMessage({ id: 1, job: { values: {} } });
    setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, code: "timeout" });
    }, 20000).unref();
  });
}
const near = (px, [r, g, b]) => Math.abs(px[0] - r) < 40 && Math.abs(px[1] - g) < 40 && Math.abs(px[2] - b) < 40;
/** Where the RED corner block (raw top-left) and BLUE block (raw bottom-right) landed in the output. */
async function inspect(data) {
  const img = await loadImage(data);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const at = (x, y) => ctx.getImageData(x, y, 1, 1).data;
  const corners = { TL: at(20, 20), TR: at(img.width - 20, 20), BL: at(20, img.height - 20), BR: at(img.width - 20, img.height - 20) };
  const find = (rgb) => Object.entries(corners).find(([, px]) => near(px, rgb))?.[0] ?? "-";
  return { w: img.width, h: img.height, red: find([255, 0, 0]), blue: find([0, 0, 255]), centre: [...at(img.width >> 1, img.height >> 1)].slice(0, 3).join(",") };
}
// Where the red block (raw top-left) must land when EXIF orientation 1..8 is applied (EXIF spec / TIFF 6.0 table).
const upright = { "exif-1.jpg": "TL", "exif-2.jpg": "TR", "exif-3.jpg": "BR", "exif-4.jpg": "BL", "exif-5.jpg": "TL", "exif-6.jpg": "TR", "exif-7.jpg": "BR", "exif-8.jpg": "BL" };
say("## D. Input variants through the real worker (400x300 landscape; RED block = raw top-left, BLUE = raw bottom-right)");
say();
say("| Fixture | Bytes | Result | Output size | Red at | Blue at | Verdict |");
say("|---|---|---|---|---|---|---|");
const files = (await readdir(join(HERE, "fixtures"))).sort();
for (const name of files) {
  const buf = await readFile(join(HERE, "fixtures", name));
  const r = await renderOnce(buf);
  if (!r.ok) {
    say(`| ${name} | ${buf.length} | error ${r.code} | - | - | - | rejected by the engine |`);
    continue;
  }
  const s = await inspect(r.data);
  let verdict = "ok, colours as expected";
  if (name in upright) verdict = s.red === upright[name] ? "orientation APPLIED (upright)" : "orientation NOT applied";
  else if (name.startsWith("animated")) verdict = s.red === "TL" ? "first frame only" : `unexpected (${s.centre})`;
  else if (name === "gray.jpg") verdict = "draws (greyscale, no colour check)";
  else if (name === "cmyk.jpg") verdict = s.red === "TL" && s.blue === "BR" ? "draws, colours right" : `draws, COLOURS WRONG (red=${s.red} blue=${s.blue} centre=${s.centre})`;
  else if (s.red !== "TL" || s.blue !== "BR") verdict = `WRONG PIXELS (red=${s.red} blue=${s.blue})`;
  say(`| ${name} | ${buf.length} | ok | ${s.w}x${s.h} | ${s.red} | ${s.blue} | ${verdict} |`);
}
// robustness: garbage, empty, truncated
const good = await readFile(join(HERE, "fixtures", "plain.jpg"));
for (const [label, buf] of [["empty file", Buffer.alloc(0)], ["random bytes", Buffer.from(Array.from({ length: 500 }, () => (rnd() * 256) | 0))], ["truncated JPEG (half)", good.subarray(0, good.length >> 1)]]) {
  const r = await renderOnce(buf);
  const s = r.ok ? await inspect(r.data) : null;
  say(`| ${label} | ${buf.length} | ${r.ok ? "ok" : `error ${r.code}`} | ${s ? `${s.w}x${s.h}` : "-"} | ${s?.red ?? ""} | ${s?.blue ?? ""} | ${r.ok ? `accepted, no error (blue block ${s.blue === "BR" ? "present" : "MISSING: the missing half is not detected"})` : "rejected cleanly"} |`);
}
say();

// ---------- E. full 4,000-row runs ----------
if (!process.argv.includes("--no-full") && !QUICK) {
  say("## E. Full 4,000-row run, 1600x1000 photo JPEG, JPEG q85 output");
  say();
  say("| Pool | Wall s | Failed | Peak RSS MB |");
  say("|---|---|---|---|");
  const bg = makeBackground(1600, 1000, "jpeg");
  for (const p of [3, 4]) {
    const r = await batch(bg, 1600, 4000, p, { type: "jpeg", quality: 85 });
    say(`| ${p} | ${fmt(r.seconds)} | ${r.failed} | ${fmt(r.peakMb, 0)} |`);
  }
  say();
  say("## F. 3000x2000, 4,000 rows is estimated in table A; measured here for the default pool");
  const bg2 = makeBackground(3000, 2000, "jpeg");
  const r = await batch(bg2, 3000, 1000, 3, { type: "jpeg", quality: 85 });
  say(`1,000 rows at 3000x2000, 3 workers: ${fmt(r.seconds)} s (x4 = ${fmt(r.seconds * 4, 0)} s for 4,000), failed ${r.failed}, peak RSS ${fmt(r.peakMb, 0)} MB`);
}

// ---------- G. PNG output at 3 workers (O-16: default output format = the background's format) ----------
if (!QUICK) {
  say();
  say("## G. PNG output, 1600x1000, 3 workers, 600 rows (x6.67 = 4,000 rows)");
  say();
  say("| Background | Wall s | 4,000 rows est. s | Failed | Peak RSS MB |");
  say("|---|---|---|---|---|");
  for (const type of ["jpeg", "png"]) {
    const bg = makeBackground(1600, 1000, type);
    await batch(bg, 1600, 6, 3, { type: "png" });
    const r = await batch(bg, 1600, 600, 3, { type: "png" });
    say(`| ${type} | ${fmt(r.seconds)} | ${fmt((r.seconds / 600) * 4000, 0)} | ${r.failed} | ${fmt(r.peakMb, 0)} |`);
  }
}

if (process.argv.includes("--write")) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(HERE, "output.md"), `${out.join("\n")}\n`);
}
