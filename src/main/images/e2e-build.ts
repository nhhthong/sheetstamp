declare const __SHEETSTAMP_E2E__: boolean | undefined;

/** True only in `npm run build:e2e` (electron-vite `--mode e2e`, see electron.vite.config.ts). */
export const isE2eBuild = typeof __SHEETSTAMP_E2E__ !== "undefined" && __SHEETSTAMP_E2E__;
