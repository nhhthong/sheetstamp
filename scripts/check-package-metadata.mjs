// Checks the product metadata embedded in the packaged files against package.json.
// Usage: node scripts/check-package-metadata.mjs <Sheetstamp.exe | package.deb>...
// A .exe is read from its version resource (works on any OS); a .deb needs `dpkg-deb`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NtExecutable, NtExecutableResource } from "pe-library";
import { Resource } from "resedit";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readExpected() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const builder = readFileSync(join(root, "electron-builder.yml"), "utf8");
  return {
    name: pkg.name,
    version: pkg.version,
    productName: /^productName:\s*(.+?)\s*$/m.exec(builder)?.[1],
  };
}

/** String table of the exe's version resource, e.g. { ProductName, FileVersion }. */
export function readExeVersion(file) {
  const exe = NtExecutable.from(readFileSync(file));
  const entries = NtExecutableResource.from(exe).entries;
  const [info] = Resource.VersionInfo.fromEntries(entries);
  if (!info) throw new Error("no version resource");
  const [language] = info.getAllLanguagesForStringValues();
  if (!language) throw new Error("version resource has no string table");
  return info.getStringValues(language);
}

/** Control fields of the .deb, e.g. { Package, Version }. */
export function readDebControl(file) {
  const text = execFileSync("dpkg-deb", ["-f", file], { encoding: "utf8" });
  const fields = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

// "0.1.0" and "0.1.0.0" are the same Windows file version.
const fourParts = (version) => [...version.split("-")[0].split("."), 0, 0, 0].slice(0, 4).join(".");

export function checkExe(strings, expected) {
  const problems = [];
  if (strings.ProductName !== expected.productName) {
    problems.push(`ProductName is "${strings.ProductName}", expected "${expected.productName}"`);
  }
  for (const key of ["FileVersion", "ProductVersion"]) {
    if (strings[key] == null || fourParts(strings[key]) !== fourParts(expected.version)) {
      problems.push(`${key} is "${strings[key]}", expected "${expected.version}"`);
    }
  }
  if (!strings.LegalCopyright) problems.push("LegalCopyright is empty");
  return problems;
}

export function checkDeb(control, expected) {
  const problems = [];
  if (control.Package !== expected.name) {
    problems.push(`Package is "${control.Package}", expected "${expected.name}"`);
  }
  if (control.Version !== expected.version) {
    problems.push(`Version is "${control.Version}", expected "${expected.version}"`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error(
      "usage: node scripts/check-package-metadata.mjs <Sheetstamp.exe | package.deb>...",
    );
    process.exit(2);
  }
  const expected = readExpected();
  let failed = false;
  for (const file of files) {
    const kind = extname(file).toLowerCase();
    if (kind !== ".exe" && kind !== ".deb") {
      console.error(`${file}: only .exe and .deb are supported`);
      process.exit(2);
    }
    const found = kind === ".exe" ? readExeVersion(file) : readDebControl(file);
    const problems = kind === ".exe" ? checkExe(found, expected) : checkDeb(found, expected);
    console.log(file, JSON.stringify(found, null, 2));
    for (const problem of problems) console.error(`${file}: ${problem}`);
    if (problems.length > 0) failed = true;
    else console.log(`${file}: metadata OK`);
  }
  process.exit(failed ? 1 : 0);
}
