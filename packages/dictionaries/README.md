# @safetype/dictionaries

Language packs for [SafeType.js](https://github.com/karammm/safetype).

| Pack | Import | Default |
|---|---|---|
| English | `@safetype/dictionaries/en` | ✅ |
| Hinglish (romanized Hindi) | `@safetype/dictionaries/hi-latn` | ✅ (with English) |

```ts
import { createModerationEngine } from "@safetype/core";

createModerationEngine();                           // English + Hinglish
createModerationEngine({ languages: ["en"] });      // English only

import { en } from "@safetype/dictionaries/en";
createModerationEngine({ packs: [en, myPack] });    // fully custom
```

Hate and harassment rules are signals with confidence below 1, not verdicts. Pair them with
contextual review. This package contains offensive terms by necessity.
