import { join } from "node:path";

/**
 * The window icon on Windows and Linux. macOS takes it from the app bundle, so it gets none.
 * Packaged: `resources/icon.png` (extraResources); otherwise `build/icon.png` of the checkout.
 */
export function windowIconPath(
  platform: NodeJS.Platform,
  packaged: boolean,
  resourcesPath: string,
  appPath: string,
): string | undefined {
  if (platform === "darwin") return undefined;
  return packaged ? join(resourcesPath, "icon.png") : join(appPath, "build", "icon.png");
}
