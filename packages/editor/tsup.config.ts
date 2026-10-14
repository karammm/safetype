import { defineConfig, type Options } from "tsup";

// Escape non-ASCII characters so bundles work even when served without a UTF-8 charset.
const ascii: Options["esbuildOptions"] = (options) => {
  options.charset = "ascii";
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    esbuildOptions: ascii,
  },
  {
    // Self-contained browser build (Tiptap included): window.SafeTypeEditor
    entry: { "safetype-editor.global": "src/index.ts" },
    format: ["iife"],
    globalName: "SafeTypeEditor",
    noExternal: [/.*/],
    minify: true,
    esbuildOptions: ascii,
    outExtension: () => ({ js: ".js" }),
  },
]);
