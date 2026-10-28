// Runs the packaged app's self-test and prints the result.
// Usage: node scripts/check-selftest.mjs <path to packaged executable> [extra args...]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [exe, ...extra] = process.argv.slice(2);
const out = join(tmpdir(), `sheetstamp-selftest-${Date.now()}.json`);
const ran = spawnSync(exe, [...extra, `--sheetstamp-selftest=${out}`], {
  stdio: "inherit",
  timeout: 120_000,
});
if (ran.status !== 0) {
  console.error(`packaged app exited with ${ran.status} (${ran.signal ?? "no signal"})`);
  process.exit(1);
}
const report = JSON.parse(readFileSync(out, "utf8"));
console.log(JSON.stringify(report, null, 2));
if (!report.ok || !report.packaged) {
  console.error(
    `self-test failed: ${(report.problems ?? []).join("; ") || "not a packaged build"}`,
  );
  process.exit(1);
}
console.log("self-test OK");
