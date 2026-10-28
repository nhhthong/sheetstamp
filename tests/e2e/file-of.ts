import { readFileSync } from "node:fs";
import { basename } from "node:path";

/** A file on disk as the storage takes it: the bytes and the display name. */
export const fileOf = (path: string) => ({ bytes: readFileSync(path), fileName: basename(path) });
