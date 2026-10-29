/**
 * End-of-support date (ISO, UTC) of each Electron major version the app may ship with.
 * Source: https://www.electronjs.org/docs/latest/tutorial/electron-timelines (also stated on site/index.html).
 * electron-support.test.ts fails when the Electron major in package.json has no entry: add it with the upgrade.
 */
export const ELECTRON_END_OF_SUPPORT: Readonly<Record<number, string>> = {
  45: "2027-04-27",
};

/** The date for a version string such as "45.1.0", or null when its major is not in the table. */
export function endOfSupportOf(electronVersion: string): string | null {
  const major = Number.parseInt(electronVersion, 10);
  return ELECTRON_END_OF_SUPPORT[major] ?? null;
}
