import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
  },
});
