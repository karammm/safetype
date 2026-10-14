// Bundles the Vue e2e fixture (Vue with the runtime template compiler + @safetype/vue source).
import { build } from "esbuild";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

await build({
  entryPoints: [new URL("./app.ts", import.meta.url).pathname],
  outfile: new URL("./dist/app.js", import.meta.url).pathname,
  bundle: true,
  format: "iife",
  alias: { vue: require.resolve("vue/dist/vue.esm-bundler.js") },
  define: {
    "process.env.NODE_ENV": '"development"',
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  logLevel: "warning",
});
