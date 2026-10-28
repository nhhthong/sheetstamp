import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNEL_NAMES, EVENT_NAMES, type SheetstampBridge } from "../shared/ipc";

const bridge: SheetstampBridge = {
  invoke(channel, request) {
    if (!CHANNEL_NAMES.has(channel))
      return Promise.reject(new Error(`Unknown channel: ${channel}`));
    return ipcRenderer.invoke(channel, request);
  },
  on(channel, listener) {
    if (!EVENT_NAMES.has(channel)) throw new Error(`Unknown event: ${channel}`);
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  pathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("sheetstamp", bridge);
