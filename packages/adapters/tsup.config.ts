import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "prosemirror/index": "src/prosemirror/index.ts",
    "codemirror/index": "src/codemirror/index.ts",
    "quill/index": "src/quill/index.ts",
    "lexical/index": "src/lexical/index.ts",
    "monaco/index": "src/monaco/index.ts",
    "tiptap/index": "src/tiptap/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // Editors are peer dependencies: always use the application's single copy.
  external: [/^prosemirror-/, /^@codemirror\//, /^lexical/, /^@lexical\//, "@safetype/editor"],
  // Escape non-ASCII characters so bundles work even when served without a UTF-8 charset.
  esbuildOptions(options) {
    options.charset = "ascii";
  },
});
