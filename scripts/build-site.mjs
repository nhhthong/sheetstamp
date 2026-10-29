// Builds the two static pages of the GitHub Pages site from scripts/site/template.html and the string tables.
//   node scripts/build-site.mjs          write site/index.html (English) and site/vi/index.html (Vietnamese)
//   node scripts/build-site.mjs --check  fail when the files on disk differ from the template and strings
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://nhhthong.github.io/sheetstamp/";

const pages = [
  {
    lang: "en",
    out: "site/index.html",
    base: "",
    canonical: ORIGIN,
    otherHref: "vi/",
    otherLang: "vi",
    otherLangShort: "VI",
    otherLangLabel: "Tiếng Việt",
  },
  {
    lang: "vi",
    out: "site/vi/index.html",
    base: "../",
    canonical: `${ORIGIN}vi/`,
    otherHref: "../",
    otherLang: "en",
    otherLangShort: "EN",
    otherLangLabel: "English",
  },
];

export function render(template, strings, page) {
  const values = { ...strings, ...page };
  // Strings may refer to {{base}}, so resolve twice.
  const fill = (text) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Missing string "${key}" for ${page.lang}`);
      return String(values[key]);
    });
  return fill(fill(template));
}

export function build() {
  const template = readFileSync(join(root, "scripts/site/template.html"), "utf8");
  return pages.map((page) => {
    const strings = JSON.parse(
      readFileSync(join(root, `scripts/site/strings.${page.lang}.json`), "utf8"),
    );
    return { path: join(root, page.out), html: render(template, strings, page) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  let stale = false;
  for (const { path, html } of build()) {
    if (check) {
      let current = "";
      try {
        current = readFileSync(path, "utf8");
      } catch {}
      if (current !== html) {
        console.error(`${path} is out of date: run node scripts/build-site.mjs`);
        stale = true;
      }
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, html);
      console.log(`wrote ${path}`);
    }
  }
  if (stale) process.exit(1);
}
