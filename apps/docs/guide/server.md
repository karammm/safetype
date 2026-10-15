# Server-side enforcement

Client-side moderation improves the writing experience, but it is not a security boundary: anyone can
send requests with curl, disable JavaScript, or edit the page. **Always re-check on the server** with the same rules.

A typical server policy is: masked profanity can be stored, while targeted hate and harassment are rejected.

::: code-group

```ts [Node]
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({
  mode: "mask",
  policy: { hate: { action: "block" }, harassment: { action: "block" } },
});

app.post("/comments", express.json({ limit: "64kb" }), (req, res) => {
  const check = engine.validate(String(req.body.text ?? ""));
  if (!check.valid) {
    return res.status(422).json({ errors: check.violations.map((v) => ({ category: v.category, rule: v.ruleId })) });
  }
  if (check.result.requiresReview) queueForReview(req.body.text); // e.g. quoted or reported speech
  save(check.result.text); // profanity masked
  res.status(201).end();
});
```

```python [Python]
from safetype import create_moderation_engine

engine = create_moderation_engine(
    mode="mask",
    policy={"hate": {"action": "block"}, "harassment": {"action": "block"}},
)

@app.post("/comments")
def create_comment(body: CommentIn):
    check = engine.validate(body.text)
    if not check.valid:
        raise HTTPException(422, detail=[{"category": v.category, "rule": v.rule_id} for v in check.violations])
    return save(check.result.text)
```

:::

The Python port runs the same pipeline with the same dictionaries. CI checks it against more than 1,900
results recorded from the JavaScript engine, so the browser and your Python backend always agree.

## Limit what you accept

- Cap the body size (the Node example uses 64 KB).
- Moderate every free-text field, including names and titles, not only the obvious ones.
- Store the masked text (`result.text`), and keep the original only if your moderation team needs it.

## With contextual AI

[`@safetype/ai`](/packages/ai) adds a model for things rules can't see, such as sarcasm, coded insults or threats
without swear words. It provides middleware that enforces on submit, plus an endpoint the browser can call
(API keys stay on your server):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { anthropicClassifier } from "@safetype/ai/anthropic";
import { createModerationService, expressClassifier, expressGuard } from "@safetype/ai/server";

const service = createModerationService({
  classifiers: [anthropicClassifier({ client: new Anthropic() })],
  policy: { harassment: { action: "block" } },
  authorize: (req) => Boolean(req.user), // the endpoint spends tokens: protect it
});

app.post("/api/safetype/classify", express.json(), expressClassifier(service));
app.post("/comments", express.json(), expressGuard(service, { fields: ["body"] }), saveComment);
```

If the model times out or fails, results fall back to the rule-based engine, so enforcement never stops.
Fastify, Next.js, Cloudflare Workers, Deno, Bun and Hono are covered too. See the [package page](/packages/ai).
