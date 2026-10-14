import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  },
  {
    // Self-contained browser build for <script> tags and CDNs: window.SafeType
    entry: { "safetype.global": "src/global.ts" },
    format: ["iife"],
    globalName: "SafeType",
    noExternal: [/^@safetype\//],
    minify: true,
    outExtension: () => ({ js: ".js" }),
  },
]);
