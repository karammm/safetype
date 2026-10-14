import { defineConfig, type Options } from "tsup";

// Escape non-ASCII characters so bundles work even when served without a UTF-8 charset.
const ascii: Options["esbuildOptions"] = (options) => {
  options.charset = "ascii";
};

export default defineConfig({
  entry: ["src/index.ts", "src/editor.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  esbuildOptions: ascii,
  external: ["react", "@safetype/editor"],
  // Hooks and DOM access make every export a client component (Next.js App Router).
  banner: { js: '"use client";' },
});
