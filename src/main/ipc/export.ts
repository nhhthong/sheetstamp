// Handlers of the "export" channels declared in src/shared/ipc/export.ts. Use `handle(channel, fn)` from ./define.
import { app, BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import {
  example,
  openExport,
  type PickedFolder,
  pickFolder,
  savePattern,
  setDiacritics,
} from "../../shared/ipc/export";
import { getCurrentTable } from "../data-session";
import { ExportSession } from "../export-session/session";
import { getStorage } from "../templates/store";
import { handle } from "./define";

/** The one export session of the app. */
export const exportSession = new ExportSession({
  storage: getStorage,
  table: getCurrentTable,
  defaultFolder: () => app.getPath("documents"),
});

const FOLDER_OPTIONS: OpenDialogOptions = { properties: ["openDirectory", "createDirectory"] };

export function register(): void {
  handle(openExport, ({ templateId }) => exportSession.open(templateId));
  handle(example, (request) => exportSession.example(request));
  handle(savePattern, ({ templateId, pattern }) => exportSession.savePattern(templateId, pattern));
  handle(setDiacritics, async ({ removeDiacritics }) => {
    await (await getStorage()).setChoices({ removeDiacritics });
  });

  // The folder picker opens at the last folder used; a chosen folder is checked and remembered in main.
  handle(pickFolder, async (_request, event): Promise<PickedFolder> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { ...FOLDER_OPTIONS, defaultPath: await exportSession.folder() };
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const folder = picked.filePaths[0];
    if (picked.canceled || !folder) return { ok: false, canceled: true };
    if (!(await exportSession.rememberFolder(folder))) return { ok: false, code: "bad-folder" };
    return { ok: true, folder };
  });
}
