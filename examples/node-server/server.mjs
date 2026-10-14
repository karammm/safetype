// Framework-independent server-side enforcement with Node's built-in http module.
// The browser SDK improves UX, but anyone can bypass it (devtools, curl, a modified client),
// so the server re-runs moderation before it accepts content.
import { createServer } from "node:http";
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({
  mode: "mask",
  // Server policy: masked profanity is fine to store, targeted hate/harassment is rejected.
  policy: {
    hate: { action: "block" },
    harassment: { action: "block" },
  },
});

const MAX_BODY_BYTES = 64 * 1024;
const posts = [];

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/posts") return send(res, 404, { error: "Not found" });
  try {
    const body = await readJson(req);
    if (typeof body?.text !== "string") return send(res, 400, { error: "`text` must be a string" });

    const { valid, result, violations } = engine.validate(body.text);
    if (!valid) {
      // Return categories and ranges only; never log or echo raw user text unnecessarily.
      return send(res, 422, {
        error: "Content violates community guidelines",
        violations: violations.map(({ category, ruleId, start, end, label }) => ({ category, ruleId, start, end, label })),
      });
    }

    const post = { id: posts.length + 1, text: result.text, needsReview: result.requiresReview };
    posts.push(post);
    return send(res, 201, post);
  } catch (error) {
    return send(res, error.status ?? 500, { error: error.status ? error.message : "Internal error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`SafeType example listening on http://localhost:${port}/posts`));
