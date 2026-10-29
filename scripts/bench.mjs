// Benchmark for T-10 and T-33: 4,000 rows to a ZIP through the worker pool. Kinds: word, image (JPEG quality 85, the
// Phase 0 setting), jpg (JPEG quality 90, what the app writes) and png.
// Run `npm run build` first. Usage: node scripts/bench.mjs [--rows 4000] [--runs 3] [--sizes 1,3,4]
//   [--kinds word,image,jpg,png] [--out .work/proof/phase-2-benchmark.md] [--write]
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { availableParallelism, cpus, loadavg, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { runBatch, workerFileIn } from "../out/main/batch.js";
import { makeDocx, paragraph, run, table } from "../src/main/selftest/make-docx.ts";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ROWS = Number(arg("rows", 4000));
const RUNS = Number(arg("runs", 3));
const SIZES = arg("sizes", `1,${Math.max(1, availableParallelism() - 1)},${availableParallelism()}`)
  .split(",")
  .map(Number);
const KINDS = arg("kinds", "word,image,jpg,png").split(",");
const WORKER = workerFileIn(fileURLToPath(new URL("../out/main", import.meta.url)));

const FIELDS = [
  "ten",
  "cccd",
  "dia_chi",
  "phong_ban",
  "chuc_vu",
  "luong",
  "ngay_vao_lam",
  "so_hop_dong",
];
const rows = Array.from({ length: ROWS }, (_, i) => ({
  rowNumber: i + 1,
  values: {
    ten: `Nguyễn Văn ${i} Đặng`,
    cccd: String(i).padStart(12, "0"),
    dia_chi: `Số ${i} đường Lê Lợi, Quận 1, Thành phố Hồ Chí Minh`,
    phong_ban: "Kế toán",
    chuc_vu: "Nhân viên",
    luong: "12.000.000",
    ngay_vao_lam: "01/11/2026",
    so_hop_dong: `HD-${i}`,
  },
}));

// A realistic contract: about 3 pages (120 paragraphs), a table, header and footer, 8 tags used several times.
const sentence =
  "Hai bên thống nhất ký kết hợp đồng lao động theo các điều khoản dưới đây và cam kết thực hiện đúng. ";
const body =
  Array.from({ length: 120 }, (_, i) =>
    paragraph(
      run(`Điều ${i + 1}. ${sentence.repeat(2)}`),
      run(i % 6 === 0 ? `Người lao động {{t` : "", false),
      run(
        i % 6 === 0 ? `en}} (CCCD {{cccd}}), chức vụ {{chuc_vu}}, lương {{luong}} đồng/tháng.` : "",
        true,
      ),
    ),
  ).join("") +
  table(
    paragraph(run("Họ tên: {{ten}}")),
    paragraph(run("Phòng ban: {{phong_ban}}")),
    paragraph(run("Địa chỉ: {{dia_chi}}")),
  ) +
  paragraph(run("Ngày vào làm: {{ngay_vao_lam}}. Số hợp đồng: {{so_hop_dong}}."));
const wordTemplate = await makeDocx({
  body,
  header: paragraph(run("Hợp đồng số {{so_hop_dong}}")),
  footer: paragraph(run("{{ten}} - trang 1")),
});

// A 1600x1000 certificate with 4 text boxes, using an installed font.
const family =
  GlobalFonts.families.find((f) => f.family === "Liberation Sans")?.family ??
  GlobalFonts.families[0]?.family;
const canvas = createCanvas(1600, 1000);
const ctx = canvas.getContext("2d");
const gradient = ctx.createLinearGradient(0, 0, 1600, 1000);
gradient.addColorStop(0, "#fdf6e3");
gradient.addColorStop(1, "#d6e4f0");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1600, 1000);
const box = (field, y, fontSize, style) => ({
  field,
  x: 100,
  y,
  width: 1400,
  fontSize,
  fontFamily: family,
  style,
  color: "#1a1a1a",
  align: "center",
  maxLines: 1,
  overflow: "shrink",
});
const imageTemplate = {
  background: new Uint8Array(canvas.toBuffer("image/png")),
  boxes: [
    box("ten", 300, 96, "bold"),
    box("phong_ban", 460, 48, "normal"),
    box("dia_chi", 560, 40, "italic"),
    box("so_hop_dong", 800, 36, "normal"),
  ],
};
const imageInit = (format) => ({ kind: "image", format, template: imageTemplate });
const wordInit = { kind: "word", template: wordTemplate };

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function once(label, init, extension, size) {
  const folder = await mkdtemp(join(tmpdir(), "sheetstamp-bench-"));
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();
  let peakRss = 0;
  const sampler = setInterval(() => (peakRss = Math.max(peakRss, process.memoryUsage().rss)), 100);
  const started = performance.now();
  const result = await runBatch(
    {
      init,
      rows,
      pattern: "{{so_hop_dong}}_{{ten}}",
      extension,
      folder,
      zipName: "bench.zip",
      poolSize: size,
    },
    WORKER,
  );
  const seconds = (performance.now() - started) / 1000;
  clearInterval(sampler);
  lag.disable();
  const zipBytes = (await stat(result.zipPath)).size;
  await rm(folder, { recursive: true, force: true });
  return {
    label,
    size,
    seconds,
    written: result.written,
    failed: result.failed.length,
    zipMb: zipBytes / 1e6,
    lagP99: lag.percentile(99) / 1e6,
    lagMax: lag.max / 1e6,
    rssMb: peakRss / 1e6,
  };
}

const results = [];
const CASES = {
  word: [wordInit, "docx"],
  image: [imageInit({ type: "jpeg", quality: 85 }), "jpg"],
  jpg: [imageInit({ type: "jpeg", quality: 90 }), "jpg"],
  png: [imageInit({ type: "png" }), "png"],
};
for (const [label, [init, extension]] of KINDS.map((kind) => [kind, CASES[kind]])) {
  await once(label, init, extension, SIZES[SIZES.length - 1]); // warm-up, not reported
  for (let r = 0; r < RUNS; r++) {
    for (const size of SIZES) {
      const res = await once(label, init, extension, size); // alternate sizes so drift favours none
      results.push(res);
      console.error(
        `${label} pool=${size} run ${r + 1}: ${res.seconds.toFixed(1)} s, failed ${res.failed}, lag p99 ${res.lagP99.toFixed(0)} ms`,
      );
    }
  }
}

const lines = [
  "# Benchmark (T-10, T-33)",
  "",
  `Machine: ${cpus()[0]?.model}, ${availableParallelism()} cores, ${(totalmem() / 1e9).toFixed(1)} GB RAM, load at start ${loadavg()
    .map((n) => n.toFixed(2))
    .join(" ")}`,
  `Node ${process.version}; ${ROWS} rows; ${RUNS} runs per size (alternating), one warm-up per kind not reported.`,
  `Word: contract of 120 paragraphs, a table, header and footer, 8 tags. Image: 1600x1000 gradient PNG background, 4 text boxes, font ${family}; image = JPEG quality 85, jpg = JPEG quality 90, png = PNG output.`,
  "",
  "| Kind | Pool size | Median s | Range s | Rows/s | Failed | ZIP MB | Main-thread lag p99 ms | Lag max ms | Peak RSS MB |",
  "|---|---|---|---|---|---|---|---|---|---|",
];
for (const kind of KINDS) {
  for (const size of SIZES) {
    const set = results.filter((r) => r.label === kind && r.size === size);
    const t = set.map((r) => r.seconds);
    lines.push(
      `| ${kind} | ${size} | ${median(t).toFixed(1)} | ${Math.min(...t).toFixed(1)}-${Math.max(...t).toFixed(1)} | ${(ROWS / median(t)).toFixed(0)} | ${Math.max(...set.map((r) => r.failed))} | ${median(set.map((r) => r.zipMb)).toFixed(0)} | ${median(set.map((r) => r.lagP99)).toFixed(0)} | ${Math.max(...set.map((r) => r.lagMax)).toFixed(0)} | ${Math.max(...set.map((r) => r.rssMb)).toFixed(0)} |`,
    );
  }
}
const text = `${lines.join("\n")}\n`;
console.log(text);
if (process.argv.includes("--write")) {
  await mkdir(".work/proof", { recursive: true });
  await writeFile(arg("out", ".work/proof/phase-2-benchmark.md"), text);
}
