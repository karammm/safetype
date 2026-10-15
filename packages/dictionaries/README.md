# @safetype/dictionaries

Language packs for [SafeType.js](https://github.com/karammm/safetype).

| Pack | Import | Default |
|---|---|---|
| English | `@safetype/dictionaries/en` | ✅ |
| Hinglish (romanized Hindi) | `@safetype/dictionaries/hi-latn` | ✅ (with English) |
| Hindi (Devanagari) | `@safetype/dictionaries/hi` | opt-in (`language: "hi"` adds Hinglish too) |
| Spanish | `@safetype/dictionaries/es` | opt-in |
| French | `@safetype/dictionaries/fr` | opt-in |
| German | `@safetype/dictionaries/de` | opt-in |
| Portuguese | `@safetype/dictionaries/pt` | opt-in |

```ts
import { createModerationEngine } from "@safetype/core";

createModerationEngine();                           // English + Hinglish
createModerationEngine({ languages: ["en"] });      // English only
createModerationEngine({ languages: ["en", "es", "fr"] }); // several languages
createModerationEngine({ language: "de-AT" });      // region tags use the base pack

import { en } from "@safetype/dictionaries/en";
createModerationEngine({ packs: [en, myPack] });    // fully custom
```

Each pack's header comment lists the words deliberately left out because they are also ordinary words
(e.g. Spanish "coño" would match "cono", cone). Hate and harassment rules are signals with confidence below 1, not verdicts. Pair them with
contextual review. This package contains offensive terms by necessity.
