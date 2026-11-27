# @safetype/core

Framework-independent moderation engine for [SafeType.js](../../README.md). It has no DOM
dependencies, makes no network calls by default, and works in browsers, Node, Deno, and edge runtimes.

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ mode: "mask" });
engine.moderate("What the fuck are you doing?").text; // "What the f*ck are you doing?"
```

## Severity overrides

Every rule has a severity (`low`, `medium`, `high`, `critical`), which `minSeverity` policies compare against.
Override it per word or per rule id:

```ts
const engine = createModerationEngine({ severity: { damn: "medium", "en.profanity.fuck": "critical" } });
engine.setSeverity("shit", "low"); // now ignored by default policies
engine.resetSeverity("shit");
engine.getSeverityOverrides(); // { damn: "medium", "en.profanity.fuck": "critical" }
```

See the root README for the full API.
