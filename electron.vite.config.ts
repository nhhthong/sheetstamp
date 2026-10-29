import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

// `electron-vite build --mode e2e` (npm run build:e2e) also builds preview/demo.html, the test-only host of
// WordPreview (tests/e2e/preview.spec.ts). The plain `npm run build` never ships it.
export default defineConfig(({ mode }) => ({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: "src/main/index.ts",
          "generate-worker": "src/worker/generate-worker.ts",
          batch: "src/main/export/batch.ts",
          "image-worker": "src/worker/image-worker.ts",
        },
      },
    },
    // True only in the e2e build, which loads the test font (src/main/images/e2e-build.ts).
    define: { __SHEETSTAMP_E2E__: JSON.stringify(mode === "e2e") },
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
  renderer: {
    root: "src/renderer",
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: "src/renderer/index.html",
          ...(mode === "e2e" ? { "preview-demo": "src/renderer/preview/demo.html" } : {}),
        },
      },
    },
  },
}));
