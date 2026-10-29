// IPC channels of the "settings" feature: the theme choice in Cài đặt.
import { THEMES, type Theme } from "../../main/storage/types";
import { channel, nothing, oneOf, record } from "./define";

export type { Theme };
export { THEMES };

export type Settings = { theme: Theme };

export const get = channel<undefined, Settings>("settings:get", nothing);
/** Saves the choice and applies it to the window at once. */
export const setTheme = channel<{ theme: Theme }, Settings>("settings:set-theme", (value) => ({
  theme: oneOf(record(value).theme, "theme", THEMES),
}));

export const channels = [get, setTheme] as const;
export const events = [] as const;
