import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "dist-electron/preload"),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "electron/preload/index.ts"),
      formats: ["cjs"],
      fileName: () => "index.cjs",
    },
    rollupOptions: {
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "index.cjs",
      },
    },
  },
  resolve: {
    alias: {
      "@vrm/platform-contracts": resolve(
        __dirname,
        "../../packages/platform-contracts/src",
      ),
      "@vrm/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
