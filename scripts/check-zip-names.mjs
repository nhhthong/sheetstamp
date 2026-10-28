// T-8: make a ZIP with Vietnamese file names through the real export pipeline, then extract it with
// the tools this operating system ships and check that the names come out right.
// Run `npm run build` first. Usage: node scripts/check-zip-names.mjs
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBatch, workerFileIn } from "../out/main/batch.js";
import { makeDocx, paragraph, run } from "../src/main/selftest/make-docx.ts";

const NAMES = [
  "Nguyễn Văn A",
  "Trần Thị Bích Ngọc",
  "Đặng Quốc Hưng",
  "Lê Thị Hương".normalize("NFD"), // decomposed in the data; the pipeline writes it composed
  "Phạm Ánh Dương - Kế toán",
];
const expected = NAMES.map((n) => `${n.normalize("NFC")}.docx`).sort();

const folder = await mkdtemp(join(tmpdir(), "sheetstamp-zipnames-"));
const template = await makeDocx({ body: paragraph(run("{{ten}}")) });
const result = await runBatch(
  {
    init: { kind: "word", template },
    rows: NAMES.map((ten, i) => ({ rowNumber: i + 1, values: { ten } })),
    pattern: "{{ten}}",
    extension: "docx",
    folder,
    zipName: "ten-tieng-viet.zip",
    poolSize: 1,
  },
  workerFileIn(new URL("../out/main", import.meta.url).pathname),
);
console.log(`zip: ${result.zipPath}, written ${result.written}, failed ${result.failed.length}`);

const tools = {
  linux: [
    ["unzip", (zip, out) => ["unzip", ["-o", zip, "-d", out]]],
    ["python zipfile", (zip, out) => ["python3", ["-m", "zipfile", "-e", zip, out]]],
    ["bsdtar", (zip, out) => ["bsdtar", ["-xf", zip, "-C", out]]],
  ],
  darwin: [
    ["ditto (Archive Utility engine)", (zip, out) => ["ditto", ["-x", "-k", zip, out]]],
    ["unzip", (zip, out) => ["unzip", ["-o", zip, "-d", out]]],
  ],
  win32: [
    [
      "PowerShell Expand-Archive",
      (zip, out) => [
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${out}' -Force`,
        ],
      ],
    ],
    ["tar.exe (bsdtar)", (zip, out) => ["tar", ["-xf", zip, "-C", out]]],
  ],
}[process.platform];

let failures = 0;
for (const [label, command] of tools) {
  const out = join(folder, `out-${label.replace(/\W+/g, "-")}`);
  await mkdir(out, { recursive: true });
  const [bin, args] = command(result.zipPath, out);
  const ran = spawnSync(bin, args, { encoding: "utf8" });
  if (ran.error || ran.status !== 0) {
    console.log(
      `SKIP ${label}: ${ran.error?.message ?? `exit ${ran.status}: ${ran.stderr?.trim()}`}`,
    );
    continue;
  }
  const raw = await readdir(out);
  const got = raw.map((n) => n.normalize("NFC")).sort();
  const same = JSON.stringify(got) === JSON.stringify(expected);
  const forms = [...new Set(raw.map((n) => (n === n.normalize("NFC") ? "NFC" : "NFD")))].join("+");
  console.log(`${same ? "OK  " : "FAIL"} ${label}: ${raw.length} files, stored as ${forms}`);
  if (!same) {
    failures++;
    console.log("  expected:", expected.join(" | "));
    console.log("  got:     ", got.join(" | "));
  }
}
process.exit(failures ? 1 : 0);
