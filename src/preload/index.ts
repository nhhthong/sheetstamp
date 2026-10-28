import { contextBridge, ipcRenderer } from "electron";
import { IPC, type PingRequest, type SheetstampApi } from "../shared/ipc";

const api: SheetstampApi = {
  ping: (request: PingRequest) => ipcRenderer.invoke(IPC.ping, request),
};

contextBridge.exposeInMainWorld("sheetstamp", api);
