# How moderation works

Every check runs the same pipeline, in the browser or on the server:

```
normalize → tokenize → match rules → score context → apply policy → transform text
```

1. **Normalize.** The text is lowercased, Latin accents are removed (`fück` → `fuck`) and lookalike characters
   are mapped (Cyrillic `а` → `a`). Full-width and zero-width characters, and leet inside words (`sh1t`, `$hit`),
   are handled too. Every character keeps a link back to its original position.
2. **Match.** Dictionary rules are matched whole-word. Repeated letters (`fuuuck`) and spaced letters
   (`f u c k`) are recognized, but a word is never shortened to fit a rule: `as` does not match `ass`.
3. **Score context.** A match inside quotes, or one that mentions a word ("the word …"), gets a lower confidence.
4. **Apply policy.** Each match gets an action from its category's policy.
5. **Transform.** Masks and suggestions are applied without breaking offsets, so editors can restore the caret.

## Actions

| Action | What happens | `result.text` | `allowed` |
| --- | --- | --- | --- |
| `allow` | Reported only | unchanged | `true` |
| `mask` | The word is masked: `f*ck` | masked | `true` |
| `suggest` | A friendlier word is offered | unchanged, see `suggestedText` | `true` |
| `warn` | An accessible message is shown | unchanged | `true` |
| `block` | Submission is stopped | unchanged | `false` |

The overall `result.action` is the most restrictive action across all matches.

## Categories

| Category | Default confidence | Notes |
| --- | --- | --- |
| `profanity` | 1.0 | Swear words. Masked deterministically. `low` severity ("damn", "crap") is ignored by default |
| `hate` | 0.8–0.9 | A small list of unambiguous slurs and group-violence statements |
| `harassment` | 0.7–0.9 | Insults aimed at someone (including Hindi gaali such as "lodu", "harami"), threats, self-harm incitement |
| `sexual` | 0.7–0.85 | Sexual content ("porn", "sex", "sexting") and solicitation ("send nudes"). Warns instead of masking |
| `custom` | 1.0 | Your own words and rules |

::: warning Rules are signals, not verdicts
A dictionary cannot reliably recognize hate speech: it misses coded language and can flag reclaimed or quoted
usage. Hate and harassment matches below `minConfidence` (default **0.6**) are reported with
`requiresReview: true` and are not acted on. Pair them with human review, or with a
[contextual classifier](/packages/ai).
:::

### Why harassment and sexual content warn instead of masking

Masking a whole phrase ("y** *r* *n *d**t") would be unreadable, so in `mask` mode harassment and sexual content
become `warn`. Single slurs are still masked. Some words are both: Hindi gaali like "lodu" or "harami" are masked as
profanity and also warned about as insults, so the person sees why.

The `sexual` category is on by default. To turn it off, or to make it stricter:

```ts
createModerationEngine({ policy: { sexual: { action: "allow" } } }); // off (still reported)
createModerationEngine({ policy: { sexual: { action: "block" } } }); // stop submission
engine.removeRule("en.sexual.sex"); // keep the rest, but allow the bare word "sex" (e.g. a medical app)
```

## Policies

The `mode` sets the default action for every category. Policies override it per category:

```ts
createModerationEngine({
  mode: "mask",
  policy: {
    harassment: { action: "block", minConfidence: 0.7 },
    hate: { action: "block" },
    profanity: { minSeverity: "low" }, // also mask "damn" and "crap"
  },
});
```

| Policy field | Meaning |
| --- | --- |
| `action` | What to do with matches in this category |
| `minConfidence` | Below this, matches are `requiresReview` and not acted on |
| `minSeverity` | Below this, matches are ignored |

You can change the policy later with `engine.setPolicy()` and the mode with `engine.setMode()`.

## Context

Reported speech and quotes are treated differently from direct abuse:

```ts
engine.moderate('He said "you are an idiot" to me').requiresReview; // true (quoted, needs review)
engine.moderate("you are an idiot").action; // "warn"
```

These heuristics are intentionally simple. For sarcasm, coded insults or threats without swear words, add a
[contextual classifier](/packages/ai).

## Masking

```ts
createModerationEngine({ maskStyle: "vowels" }); // f*ck (default)
createModerationEngine({ maskStyle: "partial" }); // f**k
createModerationEngine({ maskStyle: "full", maskChar: "#" }); // ####
createModerationEngine({ maskStyle: (word) => "[removed]" });
```

Masking is idempotent: `mask(mask(text)) === mask(text)`. Already-masked words are never matched again.
