// Contextual AI moderation with Claude, kept on the server.
//   ANTHROPIC_API_KEY=... node server.mjs        (without a key it runs rules-only)
import Anthropic from "@anthropic-ai/sdk";
import { anthropicClassifier } from "@safetype/ai/anthropic";
import { createModerationService, expressClassifier, expressGuard } from "@safetype/ai/server";
import express from "express";

const classifiers = process.env.ANTHROPIC_API_KEY ? [anthropicClassifier({ client: new Anthropic() })] : [];
if (!classifiers.length) console.warn("ANTHROPIC_API_KEY not set: running with rule-based moderation only.");

const service = createModerationService({
  classifiers,
  policy: { hate: { action: "block" }, harassment: { action: "block" } },
  // The classify endpoint spends model tokens. Require a signed-in user (replace with your auth/rate limit).
  authorize: (req) => req.headers["x-demo-user"] !== undefined,
});

const app = express();

// Called by the browser's remoteClassifier({ endpoint: "/api/safetype/classify" }).
app.post("/api/safetype/classify", express.json({ limit: "32kb" }), expressClassifier(service));

// Enforcement: re-check every submission (client-side moderation can be bypassed).
app.post("/comments", express.json({ limit: "32kb" }), expressGuard(service, { fields: ["body"] }), (req, res) => {
  res.status(201).json({ body: req.body.body });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`SafeType AI example on http://localhost:${port}`));
