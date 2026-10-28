# Phase 0 prototypes (throwaway)

Run on Linux with Node 22, one script at a time after `npm install` in this folder. Results are recorded in `docs/specification.md` section 9 and `.work/notes.md`. Output files (`t.xlsx`, `big.xlsx`, `*.png`) are generated and not committed.

| Script | Question | Result |
|---|---|---|
| `spike1-template.mjs` | Does easy-template-x handle split runs, tables, headers, footers, tags with diacritics, NFD tags, loops? | Yes to all. Tag keys are matched literally, so an NFD tag in a file does not match an NFC data key: normalize keys to NFC on both sides. |
| `spike2-template-perf.mjs` | Missing keys, formatting of split tags, speed | A missing key is replaced by an empty string without any warning; the value takes the format of the first run of the tag; about 4 ms per small document, so 4,000 documents take about 17 s on one thread. |
| `spike3-data.mjs` | exceljs `cell.text` with number formats; chardet on Vietnamese | `cell.text` ignores `numFmt` (1234 stays 1234 for `00000`, dates become JS strings). `ssf` formats Excel codes correctly. chardet is right on multi-line Windows-1258 and wrong on a single short line; the fixed order BOM, strict UTF-8, Windows-1258 needs no detector. |
| `spike4-canvas.mjs` | `@napi-rs/canvas`: families and styles, glyph coverage, synthetic styles, worker threads | `GlobalFonts.families` lists each family with its weights and styles. No coverage API. Bold and italic are synthesized when a face is missing. Rendering works in a `worker_thread` and draws Vietnamese diacritics. |
| `spike5-zip-xlsx.mjs` | archiver UTF-8 flag; exceljs load cost | Bit 11 is set for non-ASCII names (archiver 8 exports `ZipArchive`). 50,000 rows load in about 3 s and about 280 MB; the streaming reader takes about 1.3 s. |

Not testable on this Linux container: Electron `utilityProcess`, packaged builds, Windows and macOS behavior, fonts installed while the app runs.
