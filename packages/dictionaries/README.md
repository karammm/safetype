# @safetype/dictionaries

Language packs for [SafeType.js](https://github.com/karammm/safetype).

```ts
import { en } from "@safetype/dictionaries/en";
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ packs: [en] });
```

Hate and harassment rules are signals with confidence below 1, not verdicts. Pair them with
contextual review. This package contains offensive terms by necessity.
