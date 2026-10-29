import { defineConfig } from "@playwright/test";

// The specs assert the Vietnamese texts, so the app starts in Vietnamese; language.spec.ts clears this variable.
process.env.SHEETSTAMP_LANG = "vi";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // On CI runners, launching the same Electron binary from several workers can fail once with spawn ETXTBSY
  // ("text file busy"); one retry absorbs that without hiding real failures (a retried pass is reported as flaky).
  retries: process.env.CI ? 1 : 0,
  // One worker on CI: several Electron launches at once also hit "Electron failed to install correctly" on Windows.
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
});
