// Bundles the five-editor fixture (editors + adapter source) for the browser.
import { build } from "esbuild";

await build({
  entryPoints: [new URL("./app.ts", import.meta.url).pathname],
  outdir: new URL("./dist/", import.meta.url).pathname,
  entryNames: "app",
  bundle: true,
  format: "iife",
  loader: { ".ttf": "file", ".css": "css" },
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "error",
});
