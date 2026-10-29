/**
 * The interface language. English is the default; the choice lives in settings.json and main sets it before the
 * window opens. The renderer reads it once per page load from the preload bridge (`window.sheetstamp.lang`), and
 * changing it reloads the page, so a string can be picked when its module loads.
 */
export const LANGS = ["en", "vi"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export const isLang = (value: unknown): value is Lang =>
  (LANGS as readonly unknown[]).includes(value);

let current: Lang | null = null;

export function getLang(): Lang {
  if (current) return current;
  const g = globalThis as {
    sheetstamp?: { lang?: unknown };
    process?: { env?: Record<string, string | undefined> };
  };
  // The renderer asks the preload bridge; a Node process (main before it reads settings.json, the e2e specs that
  // open the storage themselves) follows SHEETSTAMP_LANG when it is set.
  const fromEnv = g.process?.env?.SHEETSTAMP_LANG;
  const found = g.sheetstamp?.lang ?? fromEnv;
  current = isLang(found) ? found : DEFAULT_LANG;
  return current;
}

/** Main calls this at start and when the choice changes; the renderer reloads instead. */
export function setLang(lang: Lang): void {
  current = lang;
}

/** The Vietnamese or the English version of a value, by the language in force when it is called. */
export function pick<T>(vi: T, en: T): T {
  return getLang() === "vi" ? vi : en;
}

/**
 * A table of messages that reads the language each time a property is read. For main and shared code, which load
 * before the language is known and can see it change. The two objects must not read each other's lazy values at load.
 */
export function lazy<T extends object>(vi: T, en: T): T {
  return new Proxy(vi, { get: (_target, key) => Reflect.get(getLang() === "vi" ? vi : en, key) });
}

/** For text built at call time (messages in main and shared code): never at module load, the language may not be set yet. */
export const t = (vi: string, en: string): string => pick(vi, en);
