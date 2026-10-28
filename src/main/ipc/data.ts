// Handlers of the "data" channels declared in src/shared/ipc/data.ts.
import { BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import {
  current,
  type DataResult,
  openPath,
  padColumn,
  pickFile,
  reload,
  setEncoding,
  setSheet,
} from "../../shared/ipc/data";
import { dataSession } from "../data-session";
import { handle } from "./define";

const OPEN_OPTIONS: OpenDialogOptions = {
  properties: ["openFile"],
  filters: [{ name: "Excel, CSV", extensions: ["xlsx", "csv"] }],
};

export function register(): void {
  handle(openPath, ({ path }) => dataSession.open(path));
  handle(pickFile, async (_request, event): Promise<DataResult> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const picked = window
      ? await dialog.showOpenDialog(window, OPEN_OPTIONS)
      : await dialog.showOpenDialog(OPEN_OPTIONS);
    const path = picked.filePaths[0];
    if (picked.canceled || !path) return { ok: false, canceled: true };
    return dataSession.open(path);
  });
  handle(setEncoding, ({ encoding }) => dataSession.setEncoding(encoding));
  handle(setSheet, ({ sheet }) => dataSession.setSheet(sheet));
  handle(padColumn, ({ columnIndex, width }) => dataSession.pad(columnIndex, width));
  handle(reload, () => dataSession.reload());
  handle(current, async () => ({ snapshot: await dataSession.current() }));
}
