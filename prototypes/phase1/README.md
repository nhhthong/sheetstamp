# Phase 1 prototypes (throwaway)

**Word preview** (decision for ticket T-14). Question: how to show a filled Word document "like a page", with filled
values highlighted and empty values shown as `(trống)` in red.

Method: fill the template with the real engine using marker characters around each value (U+E000 before, U+E001
after), turn the filled `.docx` into something viewable, replace the markers by highlight elements. Inputs were five of
the documents from `prototypes/phase0/spike6-realistic-docx.py` (python-docx, LibreOffice round trip, pandoc, VML text
box, first-page header and two sections).

| Option | Page layout | Header and footer | Table borders | Text box | Time per document | Where it runs | Licence |
|---|---|---|---|---|---|---|---|
| `docx-preview` 0.4.1 | A4 pages, styles kept | shown | shown | shown | 24-209 ms | renderer (needs a DOM) | Apache-2.0 |
| `mammoth` 1.13.0 | none, flowing HTML | dropped | dropped | shown | 25-181 ms | main process (Node) | BSD-2-Clause |

All highlights and `(trống)` markers were found in every document with both options. Chosen: **docx-preview** in the
renderer, because the spec asks for a page-like preview and `mammoth` loses the header and footer. The main process
fills the template with the markers and sends the bytes; the renderer shows it. Run with a Chromium available:
`npm i mammoth docx-preview jszip easy-template-x`, put the `.docx` files in `../real/`, then run the three scripts in
order (`node`, `node`, `node ...cjs`).
