// IPC channels of the "storage" feature: what happened when the data folder was opened.
import { channel, nothing } from "./define";

export type StorageStatus = {
  /** Problems found while opening that did not stop the app (a corrupt file moved aside, records skipped). */
  warnings: { file: string; message: string }[];
  /** Set when the data folder could not be opened. The library is then not usable and nothing was changed. */
  error: { code: "newer-schema" | "io"; message: string } | null;
};

export const status = channel<undefined, StorageStatus>("storage:status", nothing);

export const channels = [status] as const;
export const events = [] as const;
