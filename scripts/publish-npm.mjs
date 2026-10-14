// Publishes every @safetype/* package to npm in dependency order.
//   node scripts/publish-npm.mjs --dry-run          check what would be published
//   node scripts/publish-npm.mjs --otp=123456       first manual release (npm 2FA code)
//   node scripts/publish-npm.mjs --provenance       CI (GitHub Actions trusted publishing)
// Versions already on the registry are skipped, so a failed run can simply be re-run.
// Requires `pnpm build` first. `pnpm pack` replaces workspace:* ranges with real versions.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORDER = ["shared", "dictionaries", "core", "dom", "editor", "react", "vue", "angular"];
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const passThrough = args.filter((a) => a.startsWith("--otp=") || a === "--provenance" || a.startsWith("--tag="));
const out = mkdtempSync(join(tmpdir(), "safetype-publish-"));

const run = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

function published(name, version) {
  try {
    // A 404 here just means "not published yet"; keep npm's error output quiet.
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version"], { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" });
    return out.trim() === version;
  } catch {
    return false;
  }
}

for (const dir of ORDER) {
  const pkgDir = join("packages", dir);
  // Angular is built by ng-packagr and published from dist/ (its manifest is finalized at build time).
  const publishDir = dir === "angular" ? join(pkgDir, "dist") : pkgDir;
  const { name, version } = JSON.parse(readFileSync(join(publishDir, "package.json"), "utf8"));
  if (published(name, version)) {
    console.log(`= ${name}@${version} already published, skipping`);
    continue;
  }
  let target = publishDir;
  if (dir !== "angular") {
    run("pnpm", ["pack", "--pack-destination", out], pkgDir);
    target = join(out, `${name.replace("@", "").replace("/", "-")}-${version}.tgz`);
  }
  const publishArgs = ["publish", target, "--access", "public", ...passThrough, ...(dryRun ? ["--dry-run"] : [])];
  console.log(`> npm ${publishArgs.join(" ").replace(/--otp=\d+/, "--otp=******")}`);
  execFileSync("npm", publishArgs, { stdio: "inherit" });
}
console.log(dryRun ? "Dry run complete." : "All packages published.");
// Brand-new packages can take a few minutes to appear publicly: npm's CDN may cache the "not found"
// answer from the check above. `npm access list packages @safetype` shows them immediately.
