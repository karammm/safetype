# AI moderation server example

Express server that adds Claude-based contextual moderation on top of SafeType's rules.

```bash
pnpm install && pnpm build                                        # from the repository root
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @safetype/example-ai-server start
```

```bash
# The browser's remoteClassifier calls this (keys never leave the server)
curl -s localhost:3000/api/safetype/classify -H 'x-demo-user: 1' -H 'content-type: application/json' \
  -d '{"text":"honestly, people like you should not exist"}'

# Submissions are re-checked before storing
curl -s localhost:3000/comments -H 'content-type: application/json' -d '{"body":"what the fuck"}'
```

In the browser:

```js
import { createSafeType } from "@safetype/dom";
import { remoteClassifier } from "@safetype/ai";

createSafeType({ classifiers: [remoteClassifier({ endpoint: "/api/safetype/classify" })] }).start();
```
