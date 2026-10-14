# @safetype/core

Framework-independent moderation engine for [SafeType.js](../../README.md). It has no DOM
dependencies, makes no network calls by default, and works in browsers, Node, Deno, and edge runtimes.

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ mode: "mask" });
engine.moderate("What the fuck are you doing?").text; // "What the f*ck are you doing?"
```

See the root README for the full API.
