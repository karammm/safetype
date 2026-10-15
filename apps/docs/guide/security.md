# Security and privacy

## Privacy

- **Nothing leaves the device by default.** Rule-based moderation runs locally. There is no telemetry, analytics
  or remote dictionary download.
- **Network calls happen only if you add them.** A contextual classifier (`@safetype/ai`, or your own) is the only
  thing that sends text anywhere, and only to the endpoint you configure.
- **Keys stay on your server.** Browser code talks to your endpoint (`remoteClassifier`). The Claude or other model
  key is used only by your server (`createModerationService`), which also controls access (`authorize`), request
  size (`maxTextLength`) and caching.
- **Sensitive fields are skipped.** Password, email, credit-card and one-time-code fields, and anything marked
  `data-safetype="off"`, are never read or changed.

## The client is not a security boundary

Anyone can bypass moderation in the browser, with devtools, curl or a modified client. Treat it as a writing aid,
and [enforce on the server](./server) with the same rules.

## Algorithmic complexity (ReDoS)

User text is never run through backtracking regular expressions. Dictionary patterns compile to token lookups,
and the few regular expressions in the code are single character classes. The test suite feeds adversarial input
(huge single words, thousands of phrase openings, stacked combining marks, zero-width characters) at two sizes
and fails if time grows faster than linearly. See [Performance](./performance).

## Fuzzing

Every push runs about 9,000 random inputs through the JavaScript engine and 3,000 through Python, built from
dictionary words, obfuscations and Unicode edge cases (lone surrogates, combining marks, emoji, Devanagari,
lookalikes). Each run checks that:

- the engine never throws
- every match points at the exact original text
- offsets map back inside the text, in order
- masking is idempotent, and moderating moderated text changes nothing

Fuzzing found one bug in 1.10: a Hindi word ending in a digit could be masked twice. It is fixed and covered by a
regression test.

## Supply chain

- **Few dependencies.** `@safetype/core`, `dom`, `react`, `vue`, `angular`, `adapters` and `ai` have no third-party
  runtime dependencies besides other `@safetype/*` packages (and `tslib` for Angular). `@safetype/editor` depends
  on Tiptap and ProseMirror. Frameworks and editors are peer dependencies you already have.
- **Permissive licences only.** CI fails if any production dependency is not under a permissive licence (today:
  43 packages, all MIT or 0BSD).
- **No known vulnerabilities.** CI runs `pnpm audit` on what users install and fails on high or critical advisories.
- **No install scripts.** No package runs code when you install it.
- **Provenance.** Every npm release is built and published by GitHub Actions with
  [npm provenance](https://docs.npmjs.com/generating-provenance-statements), through trusted publishing with no
  long-lived tokens. You can check that a package came from this repository with `npm audit signatures`. The
  Python package is published to PyPI with trusted publishing too.

## Reporting a vulnerability

Please use [private vulnerability reporting](https://github.com/karammm/safetype/security/advisories/new) and do not
open a public issue. See [SECURITY.md](https://github.com/karammm/safetype/blob/main/SECURITY.md) for scope and
response times.
