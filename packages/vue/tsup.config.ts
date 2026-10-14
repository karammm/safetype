import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["vue"],
  // Escape non-ASCII characters so bundles work even when served without a UTF-8 charset.
  esbuildOptions(options) {
    options.charset = "ascii";
  },
});
