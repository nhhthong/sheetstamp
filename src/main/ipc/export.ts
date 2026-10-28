// Handlers of the "export" channels declared in src/shared/ipc/export.ts. Use `handle(channel, fn)` from ./define.
import { app, BrowserWindow, dialog, type OpenDialogOptions, shell } from "electron";
import {
  cancel,
  example,
  openExport,
  type PickedFolder,
  pickFolder,
  progress,
  resetData,
  reveal,
  savePattern,
  setDiacritics,
  start,
} from "../../shared/ipc/export";
import { exportMessages } from "../../shared/messages/export";
import { dataSession, getCurrentTable } from "../data-session";
import { runBatch, workerFileIn } from "../export/batch";
import { ExportSession } from "../export-session/session";
import { getStorage } from "../templates/store";
import { emit, handle } from "./define";

/** The one export session of the app. */
export const exportSession = new ExportSession({
  storage: getStorage,
  table: getCurrentTable,
  // In dev and in the packaged app the worker is built next to the main bundle (see src/main/selftest).
  run: (request) => runBatch(request, workerFileIn(import.meta.dirname)),
  defaultFolder: () => app.getPath("documents"),
  onProgress: (value) => emit(progress, value),
});

const CLOSE_WAIT_MS = 10_000;

/**
 * Closing the window while files are being made asks first (a native box: the system needs the answer before the
 * window goes). Any other time the window closes at once. "Hủy và đóng" cancels the export, waits until the
 * temporary file is gone, then closes.
 */
export function guardClose(win: BrowserWindow, session: ExportSession = exportSession): void {
  let asking = false;
  let closing = false;
  win.on("close", (event) => {
    if (closing || !session.running) return;
    event.preventDefault();
    if (asking) return;
    asking = true;
    const text = exportMessages.closeDialog;
    void dialog
      .showMessageBox(win, {
        type: "warning",
        title: text.title,
        message: text.message,
        buttons: [text.stay, text.close],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      .then(async ({ response }) => {
        if (response !== 1) return;
        session.cancel();
        // Bounded: a stuck export must not keep the window (and the process) alive forever.
        await Promise.race([session.settled(), new Promise((r) => setTimeout(r, CLOSE_WAIT_MS))]);
        closing = true;
        if (!win.isDestroyed()) win.close();
      })
      .finally(() => {
        asking = false;
      });
  });
}

const FOLDER_OPTIONS: OpenDialogOptions = { properties: ["openDirectory", "createDirectory"] };

export function register(): void {
  handle(openExport, ({ templateId }) => exportSession.open(templateId));
  handle(example, (request) => exportSession.example(request));
  handle(savePattern, ({ templateId, pattern }) => exportSession.savePattern(templateId, pattern));
  handle(setDiacritics, async ({ removeDiacritics }) => {
    await (await getStorage()).setChoices({ removeDiacritics });
  });

  handle(pickFolder, async (_request, event): Promise<PickedFolder> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { ...FOLDER_OPTIONS, defaultPath: await exportSession.folder() };
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const folder = picked.filePaths[0];
    if (picked.canceled || !folder) return { ok: false, canceled: true };
    if (!(await exportSession.rememberFolder(folder))) {
      return { ok: false, code: "bad-folder" };
    }
    return { ok: true, folder };
  });

  handle(resetData, () => dataSession.clear());
  handle(start, (request) => exportSession.start(request));
  handle(cancel, () => exportSession.cancel());
  handle(reveal, ({ what }) => {
    const path = exportSession.pathToReveal(what);
    if (!path) return { ok: false };
    shell.showItemInFolder(path);
    return { ok: true };
  });
}
