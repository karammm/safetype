# Engine API

`@safetype/core` is the engine every other package uses. It has no DOM dependency and runs in browsers,
Node 18+, Deno, Bun, workers and edge runtimes.

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine(config);
```

## Configuration

| Option | Type | Default | |
| --- | --- | --- | --- |
| `mode` | `"allow" \| "mask" \| "suggest" \| "warn" \| "block"` | `"mask"` | Default action for every category |
| `language` | `string` | `"en"` | Picks the built-in packs (`"en"` = English + Hinglish) |
| `languages` | `string[]` | | Exact packs, e.g. `["en", "es"]`. See [Languages](./languages) |
| `categories` | `ModerationCategory[]` | all | Only check these categories |
| `policy` | `PolicyMap` | | Per-category overrides. See [policies](./concepts#policies) |
| `customWords` | `string[]` | | Extra words, category `custom` |
| `allowList` | `string[]` | | Words that are never violations |
| `rules` | `ModerationRule[]` | | Extra rules. See [rules](./rules) |
| `packs` | `DictionaryPack[]` | | Replace the built-in packs entirely |
| `maskStyle` | `"vowels" \| "partial" \| "full" \| (text) => string` | `"vowels"` | |
| `maskChar` | `string` | `"*"` | One non-letter, non-digit character |
| `detectSpacedLetters` | `boolean` | `true` | Catch `f u c k` |
| `classifiers` | `ContextualClassifier[]` | | Async providers for `moderateAsync` |
| `classifierTimeoutMs` | `number` | `3000` | Per provider |
| `onModerated`, `onViolation`, `onWarning`, `onBlocked`, `onError` | callbacks | | Same as `engine.on(...)` |

## Methods

```ts
engine.moderate(text); // ModerationResult (synchronous, local only)
await engine.moderateAsync(text, { signal, timeoutMs }); // + contextual classifiers
engine.mask(text); // string
engine.validate(text); // { valid, result, violations }

engine.addRule(rule);
engine.removeRule(id);
engine.getRules();
engine.setPolicy({ hate: { action: "block" } });
engine.setMode("warn");

const off = engine.on("violation", (result) => {}); // moderated | violation | warning | blocked | error
off();

const session = engine.createSession({ debounceMs: 150 });
await session.moderate(text); // undefined if a newer call superseded it
session.cancel();
```

## The result

```ts
interface ModerationResult {
  originalText: string;
  text: string; // after masking
  suggestedText: string; // with suggestions applied
  action: ModerationAction; // the most restrictive action across matches
  allowed: boolean; // false only when action is "block"
  requiresReview: boolean;
  matches: ModerationMatch[];
  mapping: OffsetMapping; // toTransformed(offset), toOriginal(offset)
}

interface ModerationMatch {
  start: number; // offsets in the original text (UTF-16)
  end: number;
  text: string;
  category: "profanity" | "hate" | "harassment" | "sexual" | "custom";
  ruleId: string; // e.g. "en.profanity.fuck"
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0..1 after context
  context: "direct" | "quoted" | "mention";
  action: ModerationAction;
  applied: boolean; // changed result.text
  requiresReview: boolean;
  suggestedReplacement?: string;
  label?: string; // "slur", "insult", "threat", ...
  source?: string; // the classifier that reported it
}
```

## Contextual classifiers

```ts
const engine = createModerationEngine({
  classifiers: [
    {
      name: "my-server",
      async classify({ text, matches, language, signal }) {
        const res = await fetch("/api/moderate", { method: "POST", body: JSON.stringify({ text }), signal });
        return res.json(); // { matches?: ProviderMatch[], adjustments?: ConfidenceAdjustment[] }
      },
    },
  ],
});

const result = await engine.moderateAsync(text);
result.providers; // ["my-server"]
result.failedProviders; // [] (failed or timed-out providers fall back to rule-based results)
```

Providers run in parallel, each with its own timeout. [`@safetype/ai`](/packages/ai) has ready-made providers
for Claude, any LLM, your own endpoint, and in-browser models.
