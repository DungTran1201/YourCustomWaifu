import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";
import { resolve } from "node:path";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      root: resolve(__dirname),
      include: ["tests/**/*.{test,spec}.ts"],
    },
  }),
);
