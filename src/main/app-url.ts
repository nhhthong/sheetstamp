import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";

/** The one page of the app in a production build. Same file in a packaged app (asar) and in `electron .`. */
export function appPageFile(): string {
  return join(app.getAppPath(), "out", "renderer", "index.html");
}

/** Scheme, host and path only: a hash or query never makes another page. */
function stripped(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

/** The exact page this app serves: the dev server URL in dev, `out/renderer/index.html` otherwise. */
export function appPageUrl(): string {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return stripped(dev ?? pathToFileURL(appPageFile()).href) ?? "";
}

/** The test-only page of `npm run build:e2e`; it exists only in that build and is trusted only when asked for. */
function demoPageUrl(): string | undefined {
  if (process.env.SHEETSTAMP_E2E !== "1") return undefined;
  return stripped(
    pathToFileURL(join(app.getAppPath(), "out", "renderer", "preview", "demo.html")).href,
  );
}

/** True only for the app's own page. Any other file:// or http(s) URL, even on the same origin, is not it. */
export function isAppUrl(url: string): boolean {
  const normalized = stripped(url);
  if (normalized === undefined) return false;
  return normalized === appPageUrl() || normalized === demoPageUrl();
}
