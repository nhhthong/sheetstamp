# T-14 report: Word preview

Proof: `npx playwright test tests/e2e/preview.spec.ts` (4 tests green), `npx vitest run src/main/preview` (5 tests).
Row change on the sample (two pages, header, footer, table): 115-142 ms, limit 500 ms.

## Ambiguities, options, choices

- Unmapped tag versus empty string. Main gives every field tag a value between U+E000 and U+E001. Empty string: nothing
  between them (renderer shows `(trống)` in red). Unmapped (in `unmapped`, or absent from `values`): U+E002 plus the key
  between them (renderer shows `(thiếu)`, key in the tooltip). The engine's own `missing` behaviour (leave `{{tag}}`
  visible) is not used, so a literal `{{x}}` in a value cannot be confused with it.
- Special characters. `<`, `&`, quotes: the engine escapes them. `{{ten}}` inside a value stays text. Line breaks
  spread a value over several runs: the renderer keeps an "inside a value" state across text nodes. Marker characters
  inside a value (from a cell) are stripped in main so a value cannot fake a marker. The renderer builds DOM nodes
  (textContent), never HTML strings, so `<img onerror>` stays text (tested).
- Template input: bytes only (`template: Uint8Array`). No template store exists yet (T-16/T-17), so an "id the main
  process resolves" would have nothing to resolve; T-21 can pass the bytes it got from T-20. Bytes are sent on each
  change (small, well inside the 500 ms).
- Cannot-draw fallback: main also returns plain text of header, body, footer; the renderer shows it with the same
  highlights in a `<pre>` plus a warning Status. Triggered when docx-preview throws or draws no `section.docx`. If the
  engine itself cannot read the file, a danger Status is shown. docx-preview is tolerant: the test uses a footnotes
  part that is not XML (engine never parses it, docx-preview does).
- CSP unchanged. docx-preview options `useBase64URL: true` (images as data:, blob: is blocked) and `ignoreFonts: true`
  (embedded fonts need font-src data:/blob:; skipped, the document uses installed fonts). Inline styles are allowed.
- Hyperlinks: `href` and `target` are removed after rendering, a capture click handler prevents default; main already
  denies `will-navigate` to non-app URLs and window.open. Tested with left and middle click.
- Exported files never hold markers: preview and export use separate calls of the engine; export gets the raw values.
  Unit test fills for preview, then renders the same template as an export and checks every XML part for U+E000-E002.

## Outside owned files (smallest possible)
- `electron.vite.config.ts`: renderer `build.rollupOptions.input` now lists `index.html` and `preview/demo.html`.
- New fixtures `tests/fixtures/word/make-preview-sample.py` (python-docx) and `preview-contract.docx`.
- The demo page ships in the build (about 1 KB html plus a shared chunk); it is only used by the e2e test.

## Open items
- docx-preview injects global classes (`.docx-wrapper`, `.docx`); two WordPreview instances showing different
  documents at once would share styles. One at a time is fine.
- Fonts: the preview uses system fonts, so line breaks can differ a little from Word.
- Component: `WordPreview` in `src/renderer/preview/WordPreview.tsx`, props `template`, `values`, `unmapped?`, `className?`.
