// Handlers of the "images" channels declared in src/shared/ipc/images.ts.
import { join } from "node:path";
import { app } from "electron";
import {
  listFonts,
  openImageEditor,
  render,
  sampleRow as sampleRowChannel,
  saveImageLayout,
} from "../../shared/ipc/images";
import type { ImageInit } from "../../worker/image-job";
import { getCurrentTable } from "../data-session";
import { isE2eBuild } from "../images/e2e-build";
import { createImageService, type ImageService, imageWorkerFileIn } from "../images/service";
import {
  openImageEditor as openEditor,
  sampleRow,
  saveImageLayout as saveLayout,
} from "../templates/image-editor";
import { getStorage } from "../templates/store";
import { handle } from "./define";

/** Where workers look for fonts. The e2e build uses the test font only, so results do not depend on the runner's fonts. */
export const fontInit = (): ImageInit => ({
  fontFolders: isE2eBuild ? [join(app.getAppPath(), "tests", "fixtures", "fonts")] : [],
  systemFonts: !isE2eBuild,
});

let shared: ImageService | undefined;

/** The one image worker of the app (fonts, preview, export samples). Started on first use. */
export function imageService(): ImageService {
  // The variable must be set in the real process before a worker loads the canvas library, and the rescan skips
  // the system folders.
  if (isE2eBuild) process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
  shared ??= createImageService(imageWorkerFileIn(import.meta.dirname), fontInit());
  return shared;
}

export function register(): void {
  const service = imageService();
  handle(listFonts, () => service.listFonts());
  handle(render, (request) => service.render(request));
  handle(openImageEditor, async ({ id }) => openEditor(await getStorage(), id));
  handle(saveImageLayout, async (request) => saveLayout(await getStorage(), request));
  handle(sampleRowChannel, ({ fields }) => sampleRow(getCurrentTable(), fields));
  app.on("browser-window-focus", () => service.rescanIfStarted());
  app.on("will-quit", () => void service.close());
}
