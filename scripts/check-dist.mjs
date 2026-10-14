// Fails if any published bundle contains non-ASCII bytes. Raw Unicode in a bundle breaks
// (e.g. "Invalid regular expression") when a site serves it without a UTF-8 charset.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const offenders = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(c|m)?js$/.test(name)) {
      const bytes = readFileSync(path);
      const index = bytes.findIndex((b) => b > 0x7f);
      if (index !== -1) offenders.push(`${path} (byte ${index})`);
    }
  }
}
for (const pkg of readdirSync("packages")) {
  try {
    walk(join("packages", pkg, "dist"));
  } catch {
    // package without dist
  }
}
if (offenders.length) {
  console.error("Non-ASCII bytes in bundles:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("All bundles are ASCII-only.");
