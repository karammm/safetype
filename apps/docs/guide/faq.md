# Limitations and FAQ

## What SafeType can't do

- **It doesn't understand meaning.** Rules miss new spellings, coded language and sarcasm, and can flag reclaimed
  or quoted words. That is why hate and harassment results carry a confidence score and `requiresReview`.
  For context-heavy moderation, add a [contextual classifier](/packages/ai).
- **The context heuristics are simple.** Quotes and phrases like "the word …" lower confidence, but irony and
  reported speech without those markers are not recognized.
- **Lookalike mapping is tuned for Latin-script packs.** Cyrillic and Greek letters that look like Latin ones
  are mapped. Other scripts are matched as written.
- **Client-side moderation can be bypassed.** Always [check again on the server](./server).

## Will it flag "Scunthorpe", "assassin" or "class"?

No. Matching is whole-word, and repeated-letter tolerance never shortens a word, so `as` never matches `ass`.
Each language pack has a test list of everyday sentences that must stay clean.

## Can people get around it with `f u c k`, `sh1t` or `fuuuck`?

Those are caught, along with leet, lookalike letters, accents, full-width letters and zero-width characters. A
determined person can always invent new spellings, which is another reason to enforce on the server and to let
people report content.

## Why was harassment warned about instead of masked?

Masking a whole phrase makes it unreadable, so multi-word hate and harassment matches warn in `mask` mode. Set
`policy: { harassment: { action: "block" } }` to stop them instead.

## Does it send my users' text anywhere?

No, not unless you add a contextual classifier that calls your server. See [Security and privacy](./security).

## Can I use it in Python, or on the server only?

Yes. `pip install safetype` runs the same pipeline with the same dictionaries, and `@safetype/core` works in Node,
Deno, Bun, workers and edge runtimes.

## A word is missing, or something innocent was flagged

[Open an issue](https://github.com/karammm/safetype/issues/new/choose) with the text and the language. False
positives are treated as bugs.
