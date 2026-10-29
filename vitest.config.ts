import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    // The assertions are written against the Vietnamese texts; i18n.test.ts and the language tests switch explicitly.
    setupFiles: ["src/test-setup.ts"],
  },
});
