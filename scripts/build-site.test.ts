import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "./build-site.mjs";

const strings = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(join(import.meta.dirname, `site/strings.${lang}.json`), "utf8"));

describe("site pages", () => {
  it("English and Vietnamese define the same strings", () => {
    expect(Object.keys(strings("vi")).sort()).toEqual(Object.keys(strings("en")).sort());
  });

  it("the pages on disk match the template and the strings (run node scripts/build-site.mjs)", () => {
    for (const { path, html } of build()) {
      expect(readFileSync(path, "utf8"), path).toBe(html);
    }
  });

  it("each page has one h1, a title, a description and its alternates", () => {
    for (const { html } of build()) {
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toMatch(/<title>[^<]{10,70}<\/title>/);
      expect(html).toMatch(/name="description" content="[^"]{80,170}"/);
      expect(html).toContain('hreflang="en"');
      expect(html).toContain('hreflang="vi"');
      expect(html).not.toMatch(/\{\{\w+\}\}/);
    }
  });
});
