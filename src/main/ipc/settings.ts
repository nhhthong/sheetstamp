// Handlers of the "settings" channels declared in src/shared/ipc/settings.ts.
import { nativeTheme } from "electron";
import { get, setTheme } from "../../shared/ipc/settings";
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

export function register(): void {
  handle(get, async () => {
    try {
      return await (await getStorage()).getSettings();
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });
  handle(setTheme, async ({ theme }) => {
    const saved = await (await getStorage()).setSettings({ theme });
    applyTheme(saved.theme);
    return saved;
  });
}
