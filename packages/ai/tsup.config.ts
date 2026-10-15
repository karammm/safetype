import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "server/index": "src/server/index.ts", "anthropic/index": "src/anthropic/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["@anthropic-ai/sdk"],
  // Escape non-ASCII characters so bundles work even when served without a UTF-8 charset.
  esbuildOptions(options) {
    options.charset = "ascii";
  },
});
