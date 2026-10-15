## What and why

<!-- What does this change, and why? Link the issue it fixes (e.g. "Fixes #12"). -->

## Checklist

- [ ] Tests added or updated (dictionary changes need **clean** sentences too, not only flagged ones)
- [ ] `pnpm build && pnpm typecheck && pnpm test` pass
- [ ] Engine or dictionary change: `pnpm sync:python` run, so the Python port stays identical
- [ ] Docs or README updated if behaviour changed
- [ ] Browser behaviour changed: `pnpm e2e` passes (or explain what you could not run)
