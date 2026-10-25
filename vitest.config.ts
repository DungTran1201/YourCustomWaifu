import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["apps/**/*.spec.ts", "packages/**/*.spec.ts", "tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "apps/desktop/src"),
      "@vrm/platform-contracts": resolve(
        __dirname,
        "packages/platform-contracts/src",
      ),
      "@vrm/shared": resolve(__dirname, "packages/shared/src"),
      "@vrm/app-core": resolve(__dirname, "apps/desktop/src/stores/index.ts"),
      "@vrm/ui": resolve(__dirname, "apps/desktop/src/components/index.ts"),
      "@vrm/backend": resolve(__dirname, "apps/desktop/server/index.ts"),
    },
  },
});
