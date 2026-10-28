import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { appPageFile, isAppUrl } from "./app-url";
import { registerIpc } from "./ipc";
import { guardClose } from "./ipc/export";
import { runSelfTest } from "./selftest/selftest";

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
  // Only the app's own page may load, in any frame, including after a redirect.
  const guard = (event: { url: string; preventDefault(): void }) => {
    if (!isAppUrl(event.url)) event.preventDefault();
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);
  win.webContents.on("will-frame-navigate", guard);
  // Closing during an export asks first (src/main/ipc/export.ts).
  guardClose(win);

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(appPageFile());
  return win;
}

app.whenReady().then(async () => {
  const selfTest = process.argv.find((arg) => arg.startsWith("--sheetstamp-selftest="));
  if (selfTest) {
    await runSelfTest(
      selfTest.slice("--sheetstamp-selftest=".length),
      app.isPackaged,
      import.meta.dirname,
    );
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
