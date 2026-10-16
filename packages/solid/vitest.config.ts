import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compiles test JSX like a Solid app does and resolves Solid's browser build.
  plugins: [solid()],
  resolve: { conditions: ["browser", "development"] },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    server: { deps: { inline: [/solid-js/] } },
  },
});
