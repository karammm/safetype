// Rewrites every non-ASCII UTF-16 code unit in the given JS files as a \uXXXX escape.
// esbuild's `charset: "ascii"` does not escape inside regular-expression literals (e.g. Tiptap's
// input rules), and raw Unicode breaks when a script is served without a UTF-8 charset.
// \uXXXX is valid in strings, regexes, template literals and identifiers, so behaviour is unchanged.
import { readFileSync, writeFileSync } from "node:fs";

for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, "utf8");
  let count = 0;
  const escaped = source.replace(/[\u0080-￿]/g, (ch) => {
    count++;
    return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
  if (count > 0) writeFileSync(file, escaped);
  console.log(`${file}: escaped ${count} non-ASCII character(s)`);
}
