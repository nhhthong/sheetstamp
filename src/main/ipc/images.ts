// Handlers of the "images" channels declared in src/shared/ipc/images.ts.
import { join } from "node:path";
import { app } from "electron";
import { listFonts, render } from "../../shared/ipc/images";
import { isE2eBuild } from "../images/e2e-build";
import { createImageService, imageWorkerFileIn } from "../images/service";
import { handle } from "./define";

export function register(): void {
  // The e2e build uses the test font only, so results do not depend on the runner's fonts. The variable must be set
  // in the real process before the worker loads the canvas library, and the rescan skips the system folders.
  if (isE2eBuild) process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
  const service = createImageService(imageWorkerFileIn(import.meta.dirname), {
    fontFolders: isE2eBuild ? [join(app.getAppPath(), "tests", "fixtures", "fonts")] : [],
    systemFonts: !isE2eBuild,
  });
  handle(listFonts, () => service.listFonts());
  handle(render, (request) => service.render(request));
  app.on("browser-window-focus", () => service.rescanIfStarted());
  app.on("will-quit", () => void service.close());
}
