# Contributing to SafeType.js

Thanks for helping. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Setup

```bash
corepack enable                 # provides pnpm 9 from the packageManager field
pnpm install
pnpm build && pnpm test
```

Other useful commands:

```bash
pnpm typecheck
pnpm e2e                        # real-browser tests and accessibility audits
                                # (run `pnpm --filter @safetype/dom exec playwright install` once)
pnpm --filter @safetype/core test:perf   # linear-time checks and performance budgets
pnpm --filter @safetype/docs dev         # documentation site on localhost
pnpm sync:python                # after engine or dictionary changes
pnpm check:licenses
cd python && uv run pytest      # Python port
```

## Workflow

1. Open an issue for anything larger than a small fix, so we can agree on the approach.
2. Branch from `main`. Keep each change focused.
3. Add or update tests. Every behaviour change needs a test in `packages/*/test`.
4. Run `pnpm typecheck && pnpm test`.
5. Run `pnpm changeset` to describe user-facing changes to published packages.

## Dictionary contributions

- Profanity rules should be words that are offensive in nearly every context.
- Hate and harassment rules need a realistic `confidence` (below 1) and a `label`.
- Add false-positive tests for every new rule (e.g. `Scunthorpe`, `assassin`).
- Prefer prefix wildcards (`word*`) only when no common innocent word shares the prefix,
  or add the innocent words to the pack's `allowList`.

### Documentation

The site lives in `apps/docs` (VitePress). Guide pages are in `apps/docs/guide`, and the package pages are
generated from each package's `README.md`, so edit the README. Run `pnpm --filter @safetype/docs dev` to preview,
and keep outputs shown in the docs in sync with `packages/core/test/docs-examples.test.ts`.

### Reviewing a language (no code needed)

Native speakers are the best reviewers, and you don't have to write code:

1. Pick your language's [review issue](https://github.com/karammm/safetype/issues?q=is%3Aissue+is%3Aopen+label%3A%22native+speaker+review%22).
2. Read the pack's word list (`packages/dictionaries/src/<tag>/index.ts`). `(a|b)` means "a or b", and `word*`
   means "words starting with word". The comment at the top lists words left out on purpose.
3. Try sentences in the [playground](https://karammm.github.io/safetype/) with your language ticked.
4. Comment with missing words (meaning, strength, region), words that shouldn't be flagged (with an everyday
   example), or wrong categories. A maintainer turns comments into rules and tests.

### Adding a language

Corrections to existing packs are as welcome as new ones.

1. Create `packages/dictionaries/src/<tag>/index.ts` exporting a `DictionaryPack` (copy `es` as a template).
   Rule ids start with the tag (`es.profanity.mierda`).
2. Write patterns the way people type. Matching ignores case and Latin accents (`cabrón` = `cabron`), folds `ß` to `ss`,
   and keeps Indic vowel signs. Every token in a pattern must be a single word: `(a|b)` groups cannot contain spaces.
3. Leave out words that are ordinary in the language, or in English next to it, and list them in the header
   comment. Only allow insults like "dog" or "pig" in direct-address phrases ("you are a …").
4. Register the pack in `packages/dictionaries/src/index.ts`, `tsup.config.ts`, the `exports` map, and
   `BUILT_IN_PACKS` in `packages/core/src/create-engine.ts`.
5. Add flagged and **clean** sentences to `packages/core/test/languages.test.ts`. The clean list is the important
   one: everyday sentences that share words with the rules.
6. Run `pnpm build && pnpm sync:python`, so the Python port gets the same pack and parity cases, then `pnpm test`.

## Architecture rules

- Detection (`matcher`), decisions (`policy-engine`), and editing (`transformer`) stay separate.
- `@safetype/core` must stay DOM-free, dependency-free at runtime, and side-effect free.
- No network calls without explicit configuration.

## Releasing (maintainers)

All `@safetype/*` packages and the Python package share one version number.

1. Bump the version in every `packages/*/package.json`, `python/pyproject.toml` and `python/src/safetype/__init__.py`,
   and add a `CHANGELOG.md` entry.
2. If dictionaries or engine behaviour changed, run `pnpm build && pnpm sync:python` and commit `python/` changes.
3. Push a tag: `git tag v1.6.0 && git push origin v1.6.0`.
   - `Release (npm)` publishes every package with provenance (npm trusted publishing).
   - `Release (PyPI)` publishes `safetype` (PyPI trusted publishing).

A **new** package's first version must be published manually (npm trusted publishing can't create packages):
`npm publish <tarball> --access public` from an interactive terminal. CI skips it with a warning until then.
After the first publish, add the trusted publisher on npmjs.com (Settings → Trusted publishing).

Manual npm publish (first release, or if CI is unavailable): `pnpm release:npm -- --otp=<2FA code>`
(`--dry-run` shows what would be published). Versions already on npm are skipped.
