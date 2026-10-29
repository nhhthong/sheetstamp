import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NtExecutable, NtExecutableResource } from "pe-library";
import { Resource } from "resedit";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script without declarations
import { checkDeb, checkExe, readExeVersion } from "./check-package-metadata.mjs";

const expected = { name: "sheetstamp", version: "0.1.0", productName: "Sheetstamp" };
const dir = mkdtempSync(join(tmpdir(), "sheetstamp-pe-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Any real PE file will do as the base: stamp a version resource into a copy of a small one.
const base = createRequire(import.meta.url).resolve(
  "electron-winstaller/vendor/StubExecutable.exe",
);

function stamped(strings: Record<string, string>, version: [number, number, number, number]) {
  const exe = NtExecutable.from(readFileSync(base));
  const resource = NtExecutableResource.from(exe);
  const info = Resource.VersionInfo.createEmpty();
  info.setFileVersion(...version, 1033);
  info.setStringValues({ lang: 1033, codepage: 1200 }, strings);
  info.outputToResourceEntries(resource.entries);
  resource.outputResource(exe);
  const file = join(dir, `${Math.random().toString(36).slice(2)}.exe`);
  writeFileSync(file, Buffer.from(exe.generate()));
  return file;
}

describe("exe version resource", () => {
  const good = {
    ProductName: "Sheetstamp",
    FileVersion: "0.1.0",
    ProductVersion: "0.1.0.0",
    LegalCopyright: "Copyright 2026 nhhthong",
  };

  it("reads the strings back and accepts matching metadata", () => {
    const strings = readExeVersion(stamped(good, [0, 1, 0, 0]));
    expect(strings.ProductName).toBe("Sheetstamp");
    expect(checkExe(strings, expected)).toEqual([]);
  });

  it("reports a wrong product name and version", () => {
    const strings = readExeVersion(
      stamped({ ...good, ProductName: "Electron", FileVersion: "45.1.0" }, [45, 1, 0, 0]),
    );
    expect(checkExe(strings, expected)).toEqual([
      'ProductName is "Electron", expected "Sheetstamp"',
      'FileVersion is "45.1.0", expected "0.1.0"',
    ]);
  });
});

describe("deb control", () => {
  it("compares package and version", () => {
    expect(checkDeb({ Package: "sheetstamp", Version: "0.1.0" }, expected)).toEqual([]);
    expect(checkDeb({ Package: "sheetstamp", Version: "0.2.0" }, expected)).toEqual([
      'Version is "0.2.0", expected "0.1.0"',
    ]);
  });
});
