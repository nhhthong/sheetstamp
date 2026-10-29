// Handlers of the "settings" channels declared in src/shared/ipc/settings.ts.
import { ipcMain, nativeTheme } from "electron";
import { getLang, isLang, setLang } from "../../shared/i18n";
import { get, setLanguage, setTheme } from "../../shared/ipc/settings";
import { DEFAULT_SETTINGS, type Theme } from "../storage";
import { getStorage } from "../templates/store";
import { handle } from "./define";

/**
 * `themeSource` makes `prefers-color-scheme` follow the choice (and the operating system live for "system"),
 * so the first paint is already right when this runs before the window is created.
 */
function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme;
}

/** Reads the saved choice and applies it. An unreadable data folder leaves the default (follow the system). */
export async function applySavedTheme(): Promise<void> {
  try {
    applyTheme((await (await getStorage()).getSettings()).theme);
  } catch {
    applyTheme(DEFAULT_SETTINGS.theme);
  }
}

/**
 * Reads the saved language before the window opens. `SHEETSTAMP_LANG` (en or vi) wins when set: the end-to-end
 * tests use it to run in Vietnamese without touching the data folder.
 */
export async function applySavedLanguage(): Promise<void> {
  const forced = process.env.SHEETSTAMP_LANG;
  if (isLang(forced)) return setLang(forced);
  try {
    setLang((await (await getStorage()).getSettings()).language);
  } catch {
    setLang(DEFAULT_SETTINGS.language);
  }
}

export function register(): void {
  // The preload asks once per page load, synchronously, so `window.sheetstamp.lang` is set before any script runs.
  ipcMain.on("sheetstamp:get-lang", (event) => {
    event.returnValue = getLang();
  });
  handle(get, async () => {
    try {
      return await (await getStorage()).getSettings();
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });
  handle(setLanguage, async ({ language }) => {
    const saved = await (await getStorage()).setSettings({ language });
    setLang(saved.language);
    return saved;
  });
  handle(setTheme, async ({ theme }) => {
    const saved = await (await getStorage()).setSettings({ theme });
    applyTheme(saved.theme);
    return saved;
  });
}
