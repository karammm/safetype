# Performance

Moderation runs on every keystroke, so it has to be fast. These numbers come from the test suite on a laptop
(Node 24, Apple silicon):

| Workload | Time |
| --- | --- |
| Re-check a 5,000-character document after a keystroke | **0.45 ms** on average |
| 1,000 chat messages | 7 ms |
| 100 KB of text, all seven languages | 15–17 ms |
| Create an engine with all seven languages | a few ms |
| Python: 1,000 messages / 100 KB | 50 ms / 130 ms |

## Budgets in CI

Every push runs [performance tests](https://github.com/karammm/safetype/blob/main/packages/core/test/hardening.test.ts)
with budgets about ten times the numbers above (three times more on shared CI runners), so a real regression
fails the build:

- 100 KB in under 250 ms
- 1,000 messages in under 150 ms
- under 5 ms per keystroke on a 5,000-character document

## Linear time, always

Matching never backtracks. Patterns compile to token lookups instead of regular expressions, so the time grows
in proportion to the text. The suite checks this with adversarial inputs at 1,000 and 16,000 characters:
one 16,000-letter word, thousands of phrase openings ("you are you are…"), spaced letters, stacked combining
marks, zero-width characters, leet and already-masked text. Linear code takes about 16 times as long on the
larger input and quadratic code about 256 times, so the test fails above 64 times. Measured up to 160,000
characters, the time grows in proportion to the input.

## Bundle size

| What | Gzipped |
| --- | --- |
| `@safetype/dom` browser bundle: engine, page integration and all seven languages | 19 KB |
| `@safetype/core` (ESM, before your bundler minifies it) | 10 KB |
| `@safetype/editor` browser bundle, including Tiptap and ProseMirror | 137 KB |

All packages are ES modules with `sideEffects: false`. Import `@safetype/core` or `@safetype/dom` directly
and your bundler includes only what you use.

## While typing

- The word under the caret is left alone until it is finished, so masking never fights the person typing.
- A paste is moderated immediately, and a final pass runs on blur.
- Contextual classifiers in `moderateAsync` are debounced and only the latest call counts (`createSession`),
  so slow providers never block typing.
