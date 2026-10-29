import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ELECTRON_END_OF_SUPPORT, endOfSupportOf } from "./electron-support";

const root = join(import.meta.dirname, "../..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  devDependencies: Record<string, string>;
};

describe("Electron end-of-support table", () => {
  it("has a date for the Electron major in package.json", () => {
    const range = pkg.devDependencies.electron ?? "";
    const major = Number.parseInt(range.replace(/^[^\d]*/, ""), 10);
    expect(Number.isInteger(major), `cannot read the major of "${range}"`).toBe(true);
    expect(
      ELECTRON_END_OF_SUPPORT[major],
      `add Electron ${major} to src/shared/electron-support.ts`,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a date for the installed Electron major", () => {
    const installed = JSON.parse(
      readFileSync(join(root, "node_modules/electron/package.json"), "utf8"),
    ) as { version: string };
    expect(endOfSupportOf(installed.version)).not.toBeNull();
  });

  it("looks a version up by its major and knows none for others", () => {
    expect(endOfSupportOf("45.1.0")).toBe("2027-04-27");
    expect(endOfSupportOf("9.0.0")).toBeNull();
  });

  it("matches the date on both download pages", () => {
    expect(readFileSync(join(root, "site/index.html"), "utf8")).toContain("27 April 2027");
    expect(readFileSync(join(root, "site/vi/index.html"), "utf8")).toContain("27/04/2027");
  });
});
