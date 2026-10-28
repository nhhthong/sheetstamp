# Store templates, tag labels and mapping profiles as local JSON files

Status: accepted

The data is small (dozens of templates, tens of tags each), and SQLite (`better-sqlite3`) would add a second native module to package on three operating systems. We store it as JSON with atomic writes (temporary file, then rename) behind a `Storage` interface, so SQLite can replace it after the MVP. `node:sqlite` was rejected for now: it is a release candidate in Node 24 and its availability in Electron 45 is unchecked.
