import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: "src/main/index.ts",
          "generate-worker": "src/worker/generate-worker.ts",
          batch: "src/main/export/batch.ts",
        },
      },
    },
  },
  // A sandboxed preload script must be CommonJS, even though the package is ESM.
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: { root: "src/renderer", plugins: [react(), tailwindcss()] },
});
