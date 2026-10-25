import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, "src"),
  base: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@vrm/platform-contracts": resolve(
        __dirname,
        "../../packages/platform-contracts/src",
      ),
      "@vrm/shared": resolve(__dirname, "../../packages/shared/src"),
      "@vrm/app-core": resolve(__dirname, "src/stores/index.ts"),
      "@vrm/ui": resolve(__dirname, "src/components/index.ts"),
      "@vrm/backend": resolve(__dirname, "server/index.ts"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        stage: resolve(__dirname, "src/stage.html"),
      },
    },
  },
});
