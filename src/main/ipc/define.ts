import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from "electron";
import type { Channel, EventChannel, RequestOf, ResponseOf } from "../../shared/ipc";
import { isAppUrl } from "../app-url";

/** Only the app's own page, in the top frame, may call main. */
function isAppFrame(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  return frame !== null && frame !== undefined && frame.parent === null && isAppUrl(frame.url);
}

/**
 * Register the handler of a channel. The argument is validated with the channel's `parse`
 * before the handler sees it, and calls from other origins are refused.
 */
export function handle<C extends Channel<unknown, unknown>>(
  target: C,
  handler: (
    request: RequestOf<C>,
    event: IpcMainInvokeEvent,
  ) => ResponseOf<C> | Promise<ResponseOf<C>>,
): void {
  ipcMain.handle(target.name, async (event, raw: unknown) => {
    if (!isAppFrame(event)) throw new Error("Untrusted sender");
    return handler(target.parse(raw) as RequestOf<C>, event);
  });
}

/** Push an event to every window. */
export function emit<P>(target: EventChannel<P>, payload: P): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(target.name, payload);
}
