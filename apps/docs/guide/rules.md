# Custom words and rules

## Add words

```ts
createModerationEngine({
  customWords: ["Voldemort", "he who must not be named"],
});
```

Custom words use category `custom` and severity `medium`, and get the same handling for leet, repeated letters
and lookalikes as built-in words.

## Allow false positives

```ts
createModerationEngine({ allowList: ["bastard"] }); // e.g. a history site discussing royal succession
```

Tokens on the allow list are never matched, by any rule. The built-in packs already avoid the Scunthorpe problem
through whole-word matching, so allow lists are for words that are legitimate in your domain.

## Write rules

```ts
createModerationEngine({
  rules: [
    {
      id: "app.frak",
      pattern: "(frak|frack*)",
      category: "custom",
      severity: "medium",
      replacement: "darn", // offered in suggest mode
    },
  ],
});

engine.addRule({ id: "app.spoiler", pattern: "snape kills dumbledore", category: "custom" });
engine.removeRule("en.profanity.damn");
```

### Pattern syntax

Tokens are separated by spaces and matched after normalization, so case, accents, leet and repeated letters are
already handled.

| Pattern | Matches |
| --- | --- |
| `word` | that word only |
| `word*` | words starting with it: `fuck*` matches "fucking", "fucker" |
| `(a\|b\|c)` | any one of the alternatives (each alternative is a single word) |
| `token?` | an optional token (not allowed first) |

```
(you|u) (are|re)? (a|an)? (idiot*|moron*)   you idiot · u r a moron · you're an idiot
```

### Rule fields

| Field | | |
| --- | --- | --- |
| `id` | required | Unique. Built-in ids look like `en.profanity.fuck` |
| `pattern` | required | See above |
| `category` | required | `profanity`, `hate`, `harassment` or `custom` |
| `severity` | `medium` | `low`, `medium`, `high`, `critical` |
| `confidence` | `1` | Before context. Below the policy's `minConfidence` a match needs review |
| `priority` | by category | Higher wins when masks overlap |
| `replacement` | | Suggestion for `suggest` mode |
| `label` | | Free text, e.g. `slur`, `threat` |

## Replace the dictionaries

```ts
import { en } from "@safetype/dictionaries/en";

createModerationEngine({
  packs: [en, { language: "app", boundary: "word", rules: [/* ... */], allowList: [] }],
});
```

Use `boundary: "substring"` for languages written without spaces between words.
