import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { registerIpc } from "./ipc";
import { runProbe } from "./probe";

function isAppUrl(url: string): boolean {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev ? url.startsWith(dev) : url.startsWith("file://");
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    show: false,
    title: "Sheetstamp",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  return win;
}

app.whenReady().then(async () => {
  const probe = process.argv.find((arg) => arg.startsWith("--sheetstamp-probe="));
  if (probe) {
    await runProbe(probe.slice("--sheetstamp-probe=".length));
    app.quit();
    return;
  }
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
