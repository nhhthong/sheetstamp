import type { Theme } from "../../shared/ipc/settings";

/**
 * Sáng and Tối set `data-theme` on `<html>`; Theo hệ thống removes it, so the colours follow
 * `prefers-color-scheme`, which main keeps in step with the choice and the operating system.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
