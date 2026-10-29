// IPC channels of the "settings" feature: the theme and the language in Cài đặt.

import { THEMES, type Theme } from "../../main/storage/types";
import { LANGS, type Lang } from "../i18n";
import { channel, nothing, oneOf, record } from "./define";

export type { Theme };
export { THEMES };

export type Settings = { theme: Theme; language: Lang };

export const get = channel<undefined, Settings>("settings:get", nothing);
/** Saves the choice and applies it to the window at once. */
export const setTheme = channel<{ theme: Theme }, Settings>("settings:set-theme", (value) => ({
  theme: oneOf(record(value).theme, "theme", THEMES),
}));

/** Saves the language. The renderer reloads afterwards: it reads the language once per page load. */
export const setLanguage = channel<{ language: Lang }, Settings>(
  "settings:set-language",
  (value) => ({ language: oneOf(record(value).language, "language", LANGS) }),
);

export const channels = [get, setTheme, setLanguage] as const;
export const events = [] as const;
