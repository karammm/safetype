// Assembles the static playground (GitHub Pages) from index.html and the browser bundle.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
const bundle = createRequire(import.meta.url).resolve("@safetype/dom/global");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync(join(here, "index.html"), join(out, "index.html"));
copyFileSync(bundle, join(out, "safetype.global.js"));
writeFileSync(join(out, ".nojekyll"), "");
console.log(`Playground built in ${out}`);
