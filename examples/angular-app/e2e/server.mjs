// Serves the built app (dist/browser) for the e2e tests.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/browser/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const port = Number(process.argv[2] ?? 4184);

createServer((req, res) => {
  let path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    if (statSync(path).isDirectory()) path = join(path, "index.html");
    statSync(path);
  } catch {
    path = join(root, "index.html");
  }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(port, "127.0.0.1");
