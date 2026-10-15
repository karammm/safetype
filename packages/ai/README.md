# @safetype/ai

Contextual AI moderation for [SafeType.js](https://github.com/karammm/safetype): it catches what word lists
can't (coded insults, threats without swear words, dehumanising statements) and lowers false positives
(quoted or reported speech, discussion of language).

```bash
npm install @safetype/ai
```

**Safe by default:**
- **Opt-in.** Nothing is sent anywhere unless you add a classifier.
- **Keys stay on your server.** Browsers call *your* endpoint, and your server calls the model.
- **Rules run first and instantly.** The AI runs after a typing pause, and if it's slow, fails or declines,
  you keep the rule-based result.
- **Findings must quote the text.** Anything the model invents that isn't in the text is discarded.
- **Masking only for single words.** Multi-word AI findings (phrases, whole-text verdicts) warn or block,
  so they never mask a whole sentence.

## Server (Claude)

```ts
import Anthropic from "@anthropic-ai/sdk";               // npm install @anthropic-ai/sdk
import { anthropicClassifier } from "@safetype/ai/anthropic";
import { createModerationService, expressClassifier, expressGuard } from "@safetype/ai/server";

const service = createModerationService({
  classifiers: [anthropicClassifier({ client: new Anthropic() })], // reads ANTHROPIC_API_KEY
  policy: { harassment: { action: "block" } },
  authorize: (req) => Boolean(req.user),                   // the endpoint spends tokens: protect it
});

app.post("/api/safetype/classify", express.json(), expressClassifier(service));                    // for browsers
app.post("/comments", express.json(), expressGuard(service, { fields: ["body"] }), saveComment);  // enforcement
```

`anthropicClassifier` defaults to `claude-opus-5-5` at low effort, with structured JSON output, a
cached system prompt, and Anthropic's server-side fallback if the model declines. Options: `model`, `effort`,
`maxTokens`, `fallbacks`, `adjust`, `maxTextLength`.

Other frameworks:

```ts
await fastify.register(fastifySafeType, { service });                       // POST /api/safetype/classify
fastify.post("/comments", { preHandler: fastifyGuard(service, { fields: ["body"] }) }, handler);

export const POST = createFetchHandler(service);   // Next.js route handler, Cloudflare Workers, Deno, Bun, Hono
```

Use any other model with `llmClassifier({ complete })`. It receives `{ system, user, schema, signal }` and returns
the model's JSON answer.

## Browser

```ts
import { remoteClassifier } from "@safetype/ai";

createSafeType({ classifiers: [remoteClassifier({ endpoint: "/api/safetype/classify" })] }).start();
// React: <SafeTypeInput classifiers={[...]} />  ·  engine: createModerationEngine({ classifiers: [...] })
```

### Fully in the browser (no server)

```ts
import { pipeline } from "@huggingface/transformers";   // your choice of model, loaded lazily by your app
import { localModelClassifier } from "@safetype/ai";

const toxicity = await pipeline("text-classification", "Xenova/toxic-bert", { top_k: null });
createModerationEngine({ classifiers: [localModelClassifier({ classify: (text) => toxicity(text) })] });
```

## Safety and cost

- **Prompt injection.** User text is wrapped in delimiters, treated as data, and every finding must quote it.
  The model can still be talked into *lowering* a rule match's confidence. Use `adjust: "raise-only"`
  where that matters more than fewer false positives.
- **Cost.** Identical texts are cached (`cacheSize`, default 500). Texts over `maxTextLength` (default 4000)
  aren't sent. `authorize` lets you require sign-in or apply rate limits.
- **Not perfect.** AI classification makes mistakes in both directions. Use it as a signal, keep human review for
  `requiresReview` results, and always enforce on the server.
