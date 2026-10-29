import type { Lang } from "../i18n";

/** What the preload script exposes as `window.sheetstamp`. Names are checked against the registry. */
export interface SheetstampBridge {
  /** The interface language main chose for this page load. */
  readonly lang: Lang;
  invoke(channel: string, request?: unknown): Promise<unknown>;
  /** Subscribe to a main-to-renderer event; returns the unsubscribe function. */
  on(channel: string, listener: (payload: unknown) => void): () => void;
  /** Absolute path of a dropped file. The sandboxed renderer cannot read it from the File object. */
  pathForFile(file: File): string;
}
