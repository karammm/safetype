# SafeType.js

**Write freely. Communicate respectfully.**

<p align="center">
  <a href="docs/assets/safetype-intro.mp4">
    <img src="docs/assets/safetype-intro.gif" width="860"
      alt="SafeType.js in 45 seconds: live masking while typing, catching disguised spellings without flagging innocent words, context-aware handling of harassment, and the five moderation actions">
  </a>
  <br>
  <sub>▶ <a href="docs/assets/safetype-intro.mp4">Watch the 45-second intro in full quality (MP4)</a>. Every result shown is real output from <code>@safetype/core</code>.</sub>
</p>

SafeType.js is an open-source, framework-independent TypeScript SDK that detects profanity,
hate speech, and harassment and then masks, warns about, blocks, or suggests replacements
for them, without asking you to replace your existing editor.

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ mode: "mask", language: "en" });

engine.moderate("What the fuck are you doing?").text;
// "What the f*ck are you doing?"
```

> **Status: Phase 1 (core engine).** The DOM integration, React/Angular/Vue packages, rich-text
> editor, and AI providers are on the [roadmap](#roadmap) and are not published yet.

## Packages

| Package                  | Status | Description                                                   |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `@safetype/core`         | ✅     | Moderation engine: normalize → match → classify → policy → transform |
| `@safetype/dictionaries` | ✅     | Language packs (`en`) and the pack format                     |
| `@safetype/shared`       | ✅     | Public TypeScript contracts                                   |
| `@safetype/dom`          | Phase 2 | Auto-attach to inputs, textareas, contenteditable             |
| `@safetype/react` / `angular` / `vue` | Phase 3 | Framework bindings                               |
| `@safetype/editor` / `adapters`       | Phase 4 | Tiptap-based editor, third-party editor adapters |
| `@safetype/ai`           | Phase 5 | Contextual classifier providers                               |

## Design principles

1. **Detection, policy, and transformation are separate.** The engine finds matches, the policy decides
   what to do with each one, and the transformer edits text. Each can change without touching the others.
2. **Profanity ≠ hate speech.** Profanity is masked deterministically. Hate and harassment rules are
   lower-confidence *signals* that context can weaken. Dictionary rules alone cannot reliably detect
   hate speech, so borderline matches surface as `requiresReview` instead of being acted on automatically.
3. **Private by default.** No telemetry, and nothing leaves the device unless you configure a contextual classifier.
4. **The client is not a security boundary.** Re-run moderation on the server
   ([example](examples/node-server)).

## Modes

| Mode      | `result.text` | `allowed` | Notes                                                      |
| --------- | ------------- | --------- | ---------------------------------------------------------- |
| `allow`   | unchanged     | `true`    | Report only                                                |
| `mask`    | masked        | `true`    | Hate/harassment *phrases* fall back to `warn`              |
| `suggest` | unchanged     | `true`    | `result.suggestedText` + `match.suggestedReplacement`      |
| `warn`    | unchanged     | `true`    | Emits `warning`                                            |
| `block`   | unchanged     | `false`   | Emits `blocked`                                            |

Per-category policies override the global mode:

```ts
const engine = createModerationEngine({
  mode: "mask",
  policy: {
    harassment: { action: "block", minConfidence: 0.7 },
    profanity: { minSeverity: "low" }, // also mask "damn", "crap"
  },
});
```

Defaults: profanity ignores `low` severity; hate and harassment need confidence ≥ 0.6, and anything
below that is reported with `requiresReview: true` and action `allow`.

## What the engine handles

- **Unicode:** diacritics (`fück`), full-width forms (`ｆｕｃｋ`), Cyrillic/Greek lookalikes, zero-width characters
- **Obfuscation:** leet (`sh1t`, `$hit`), repeated letters (`fuuuck`), spaced letters (`f u c k`, `f.u.c.k`)
- **No Scunthorpe problem:** whole-word matching, and repeated-letter tolerance never shortens a word (`as` ≠ `ass`)
- **Context heuristics:** quoted text and mentions ("the word …", "he called me …") lower confidence
- **Idempotent masking:** `mask(mask(x)) === mask(x)`
- **Offset mapping:** `result.mapping.toTransformed()` / `toOriginal()` for caret restoration
- **Deterministic overlaps:** priority → span length → position → rule id
- **Languages without spaces:** `boundary: "substring"` packs

## API

```ts
const engine = createModerationEngine(config);

engine.moderate(text);                    // ModerationResult (sync, local only)
await engine.moderateAsync(text, { signal, timeoutMs }); // + contextual classifiers
engine.mask(text);                        // string
engine.validate(text);                    // { valid, result, violations }
engine.addRule({ id, pattern, category, severity, confidence, priority, replacement });
engine.removeRule(id);
engine.setPolicy({ hate: { action: "block" } });
engine.setMode("warn");
engine.on("violation", (result) => {});   // moderated | violation | blocked | warning | error

const session = engine.createSession({ debounceMs: 150 });
await session.moderate(text);             // undefined if superseded by a newer call
```

### Rule patterns

```
fuck*                                  prefix wildcard (fucking, fucker)
(ass|arse)                             alternatives
(you|u) (are|re)? (a|an)? (idiot*)     phrases with optional tokens
```

### Contextual classifiers

```ts
const engine = createModerationEngine({
  classifiers: [{
    name: "my-server",
    async classify({ text, matches, signal }) {
      const res = await fetch("/api/moderate", { method: "POST", body: JSON.stringify({ text }), signal });
      return res.json(); // { matches?: ProviderMatch[], adjustments?: ConfidenceAdjustment[] }
    },
  }],
});
```

Providers run in parallel, each with a timeout. A failing provider emits `error` and the result
falls back to the rule-based output. Never put provider credentials in browser code; proxy through
your own server.

## Development

```bash
corepack enable          # provides pnpm 9 from the packageManager field
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm bench
```

## Roadmap

1. ✅ Core engine, contracts, English pack, tests, benchmarks
2. DOM integration: MutationObserver, native inputs, caret preservation, IME, paste/undo
3. React, Angular, and Vue packages
4. Tiptap-based editor and third-party editor adapters
5. More language packs, `@safetype/ai` providers
6. Docs site, playground, Playwright suites, release automation

## Limitations

- Rule-based detection misses novel spellings, coded language, and sarcasm, and it can flag reclaimed or
  quoted usage. Treat hate/harassment results as signals for review, not verdicts.
- The context heuristics are simple. Use a contextual classifier for higher accuracy.
- Lookalike mapping is tuned for Latin-script packs.
- Client-side moderation can be bypassed. Always enforce on the server.

## License

[MIT](LICENSE)
