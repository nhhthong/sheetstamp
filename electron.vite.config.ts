import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts", "canvas-probe": "src/worker/canvas-probe.ts" },
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
  renderer: { root: "src/renderer", plugins: [react()] },
});
