// Fails when a published package depends (directly or transitively) on anything that is not under a
// permissive licence. Peer dependencies (React, Angular, editors) are chosen by the app, so they are not counted.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const ALLOWED = new Set(["MIT", "ISC", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "BlueOak-1.0.0", "CC0-1.0", "Unlicense"]);

const output = execFileSync("pnpm", ["licenses", "list", "--prod", "--json", "--filter", "./packages/*"], { encoding: "utf8" });
const byLicense = JSON.parse(output);

let problems = 0;
let total = 0;
for (const [license, deps] of Object.entries(byLicense)) {
  total += deps.length;
  const ok = license.split(/\s+OR\s+|[()]/).some((part) => ALLOWED.has(part.trim()));
  if (!ok) {
    problems++;
    for (const dep of deps) console.error(`::error::${dep.name}@${dep.versions.join(", ")} is licensed "${license}"`);
  }
}

for (const dir of readdirSync(new URL("../packages", import.meta.url))) {
  const manifest = JSON.parse(readFileSync(new URL(`../packages/${dir}/package.json`, import.meta.url), "utf8"));
  if (manifest.license !== "MIT") {
    problems++;
    console.error(`::error::${manifest.name} must declare "license": "MIT"`);
  }
}

if (problems) process.exit(1);
console.log(`Licences OK: ${total} production dependencies, all permissive (${Object.keys(byLicense).join(", ")}).`);
