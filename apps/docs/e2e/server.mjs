// Serves the built docs under the same base path as GitHub Pages (/safetype/docs/).
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../.vitepress/dist/", import.meta.url));
const base = "/safetype/docs/";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const port = Number(process.argv[2] ?? 4182);

function resolve(pathname) {
  const path = normalize(join(root, pathname.slice(base.length)));
  if (!path.startsWith(root)) return null;
  for (const candidate of [path, `${path}.html`, join(path, "index.html")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = pathname.startsWith(base) ? resolve(pathname) : null;
  if (!file) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1");
