// Bundles the React e2e fixture (React + @safetype/react source) for the browser.
import { build } from "esbuild";

await build({
  entryPoints: [new URL("./app.tsx", import.meta.url).pathname],
  outfile: new URL("./dist/app.js", import.meta.url).pathname,
  bundle: true,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "warning",
});
