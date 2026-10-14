// Exports the built dictionary packs to JSON so the Python port uses exactly the same rules.
// Run after `pnpm build`. CI fails if the committed JSON is out of date.
import { writeFileSync } from "node:fs";
import { packs } from "../packages/dictionaries/dist/index.js";

for (const [language, pack] of Object.entries(packs)) {
  const target = new URL(`../python/src/safetype/data/${language}.json`, import.meta.url);
  writeFileSync(target, JSON.stringify(pack, null, 2) + "\n");
  console.log(`exported ${language}: ${pack.rules.length} rules -> ${target.pathname}`);
}
