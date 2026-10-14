# Contributing to SafeType.js

Thanks for helping. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Setup

```bash
corepack enable
pnpm install
pnpm build && pnpm test
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

## Architecture rules

- Detection (`matcher`), decisions (`policy-engine`), and editing (`transformer`) stay separate.
- `@safetype/core` must stay DOM-free, dependency-free at runtime, and side-effect free.
- No network calls without explicit configuration.
