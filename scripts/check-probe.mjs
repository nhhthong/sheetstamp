// Spike T-2: run the packaged app's canvas probe and check the result.
// Usage: node scripts/check-probe.mjs <path to packaged executable> [extra args...]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [exe, ...extra] = process.argv.slice(2);
const out = join(tmpdir(), `sheetstamp-probe-${Date.now()}.json`);
const run = spawnSync(exe, [...extra, `--sheetstamp-probe=${out}`], {
  stdio: "inherit",
  timeout: 90_000,
});
if (run.status !== 0) {
  console.error(`packaged app exited with ${run.status} (${run.signal ?? "no signal"})`);
  process.exit(1);
}
const report = JSON.parse(readFileSync(out, "utf8"));
console.log(JSON.stringify(report, null, 2));

const problems = [];
const hashes = [];
for (const outcome of report.outcomes) {
  if (!outcome.ok) problems.push(`${outcome.mode}: ${outcome.error}`);
  if (outcome.mode === "systemFontsAtRuntime") continue;
  for (const face of outcome.result?.faces ?? []) {
    if (face.darkPixels < 500) problems.push(`${outcome.mode}/${face.style}: blank render`);
    hashes.push(`${face.style}:${face.hash}`);
  }
}
const [first, second] = [hashes.slice(0, 4).join(), hashes.slice(4, 8).join()];
if (first !== second) problems.push("worker_thread and utilityProcess drew different pixels");
if (!report.packaged) problems.push("not a packaged build");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("probe OK");
