// Generates the per-package reference pages from the package READMEs, so the docs site always
// matches what ships on npm and PyPI. Output goes to apps/docs/packages (gitignored).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docs = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(docs, "..", "..");
const out = join(docs, "packages");
const repo = "https://github.com/karammm/safetype";

/** Page slug -> README path (relative to the repo root). */
const PAGES = {
  core: "packages/core/README.md",
  dom: "packages/dom/README.md",
  react: "packages/react/README.md",
  vue: "packages/vue/README.md",
  angular: "packages/angular/README.md",
  solid: "packages/solid/README.md",
  editor: "packages/editor/README.md",
  adapters: "packages/adapters/README.md",
  ai: "packages/ai/README.md",
  dictionaries: "packages/dictionaries/README.md",
  python: "python/README.md",
};

const slugByReadme = Object.fromEntries(Object.entries(PAGES).map(([slug, path]) => [path, slug]));

function rewriteLinks(markdown, readmePath) {
  return markdown.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (whole, target) => {
    const [path, hash = ""] = target.split("#");
    const resolved = join(dirname(readmePath), path).replace(/\\/g, "/");
    const slug = slugByReadme[resolved];
    if (slug) return `](/packages/${slug}${hash ? `#${hash}` : ""})`;
    if (resolved === "README.md") return `](/${hash ? `#${hash}` : ""})`;
    return `](${repo}/blob/main/${resolved}${hash ? `#${hash}` : ""})`;
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [slug, readme] of Object.entries(PAGES)) {
  const source = readFileSync(join(root, readme), "utf8");
  const edit = `${repo}/edit/main/${readme}`;
  const page = `---\neditLink: false\n---\n\n${rewriteLinks(source, readme).trim()}\n\n---\n\n<sub>Generated from [\`${readme}\`](${repo}/blob/main/${readme}). [Edit it on GitHub](${edit}).</sub>\n`;
  writeFileSync(join(out, `${slug}.md`), page);
}
console.log(`docs: generated ${Object.keys(PAGES).length} package pages`);
