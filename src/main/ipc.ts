import { app, ipcMain } from "electron";
import { IPC, type PingResponse, parsePingRequest } from "../shared/ipc";

export function handlePing(args: unknown): PingResponse {
  const { message } = parsePingRequest(args);
  return { message, version: app.getVersion() };
}

export function registerIpc(): void {
  ipcMain.handle(IPC.ping, (_event, args: unknown) => handlePing(args));
}
