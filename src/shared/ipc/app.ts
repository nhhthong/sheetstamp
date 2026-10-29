import { channel, nothing } from "./define";

export const appInfo = channel<undefined, { name: string; version: string; electron: string }>(
  "app:info",
  nothing,
);

/** The only address the app ever opens in the browser. */
export const DOWNLOAD_PAGE_URL = "https://nhhthong.github.io/sheetstamp";

export type About = {
  version: string;
  /** ISO date (YYYY-MM-DD), or null when the Electron major has no entry in the table. */
  electronEndOfSupport: string | null;
  licence: string;
  notices: string;
};

/** Texts come from the files packaged with the app; the renderer has no file access. */
export const about = channel<undefined, About>("app:about", nothing);
/**
 * Opens DOWNLOAD_PAGE_URL in the default browser. It takes no argument, so there is no way to ask for another
 * address: `nothing` refuses any value.
 */
export const openDownloadPage = channel<undefined, undefined>("app:open-download-page", nothing);

export const channels = [appInfo, about, openDownloadPage] as const;
export const events = [] as const;
