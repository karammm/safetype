import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compiles test JSX like a Solid app does and resolves Solid's browser build.
  // The plugin's types come from a newer Vite than Vitest 2 uses; the plugin itself supports both.
  plugins: [solid() as never],
  resolve: { conditions: ["browser", "development"] },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    server: { deps: { inline: [/solid-js/] } },
  },
});
