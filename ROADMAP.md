# SafeType.js Release Roadmap

Each release is built, tested, tagged, and published on its own before work on the next one starts.

## Versioning

- **Lockstep versions.** Every `@safetype/*` package shares one version number, so `@safetype/react@1.2.0`
  always works with `@safetype/core@1.2.0`.
- **Minor releases (`1.x.0`)** add packages or features without breaking existing APIs.
- **Patch releases (`1.x.y`)** are for bug fixes and dictionary corrections and can ship at any time.
- **Breaking changes** wait for `2.0.0`. Nothing in this roadmap plans one.

## Release checklist (every version)

1. Implement the scope, with unit tests and browser tests where the DOM is involved
2. Add a working example and update the package README and root README
3. Add a changeset describing user-facing changes
4. CI green on Node 18 / 20 / 22 (and Chromium, Firefox, WebKit from 1.1 on)
5. Pack and install the tarballs in a clean project (ESM, CJS, types)
6. Tag `vX.Y.Z`, publish to npm, create the GitHub release
7. Install the published version from npm and smoke-test it

---

## v1.0.0: Core engine ✅ built · ⏳ awaiting npm publish

`@safetype/core`, `@safetype/dictionaries` (English), `@safetype/shared`

- Normalization, obfuscation handling, whole-word matching, context heuristics
- Five actions (allow / mask / suggest / warn / block), per-category policies, confidence thresholds
- Async contextual classifiers with timeout, cancellation, and latest-only sessions
- Offset mapping for caret restoration, idempotent masking
- Node server-side enforcement example, 104 tests, benchmarks

**Still to do:** npm org + login, a release workflow (publish from CI on tag with npm provenance), tag `v1.0.0`.

## v1.1.0: Universal DOM integration ✅ built · ⏳ awaiting npm publish

New package: `@safetype/dom`

- `createSafeType({ selector, mode, ... })` with `start()`, `stop()`, `destroy()`
- Auto-discovers `input`, `textarea`, and `contenteditable`, plus elements added later (MutationObserver)
- Caret and selection preserved after masking (uses the core offset mapping)
- Handles typing, paste, drag-and-drop, IME composition (no masking mid-composition), and undo/redo
- Form submission blocked when policy says `block`
- Never touches password, email, credit-card, one-time-code, or `data-safetype="off"` fields
- Accessible warnings: `aria-describedby` and a polite live region
- No duplicate listeners, no event loops, and a full cleanup in `destroy()`
- Tests: Vitest (DOM unit) + Playwright on Chromium, Firefox, and WebKit
- Vanilla JS example + a **live playground on GitHub Pages**

## v1.2.0: React

New package: `@safetype/react`

- `useSafeType()` hook, `<SafeTypeInput>`, `<SafeTypeTextarea>`, `<SafeTypeProvider>`
- Works with controlled inputs without fighting React's state
- Example app (Vite) + React Testing Library and Playwright tests

## v1.3.0: Vue

New package: `@safetype/vue`

- `v-safe-type` directive, `useSafeType()` composable, `<SafeTypeInput>` component
- Correct `v-model` behaviour + example app and tests

## v1.4.0: Angular

New package: `@safetype/angular`

- Standalone `safeType` directive, `SafeTypeService`, compatibility with reactive and template forms
- Built with ng-packagr, plus an example app and tests

## v1.5.0: Built-in rich-text editor

New package: `@safetype/editor` (Tiptap / ProseMirror)

- Bold, italic, underline, headings, lists, links, undo/redo, placeholder, character count
- Inline moderation highlights, replacement suggestions, accessible warnings, themes
- Moderation through editor transactions, so formatting is never lost
- Wrappers: `<SafeTypeEditor>` for React, Vue, and Angular

## v1.6.0: Third-party editor adapters

New package: `@safetype/adapters`

- Tiptap / ProseMirror, Quill, Lexical, CodeMirror 6, Monaco
- A documented adapter contract so the community can add more

## v1.7.0: Contextual AI providers

New package: `@safetype/ai`

- Remote provider for an **app-owned** endpoint (keys stay on your server)
- Optional local in-browser model provider (lazy-loaded, opt-in)
- Custom callback provider
- Server middleware for Express and Fastify, plus a generic `fetch` handler

## v1.8.0: Language packs

- Spanish, Hindi (Devanagari + romanized Hinglish), French, German, Portuguese
- Each pack reviewed by native speakers, with false-positive test suites
- A contribution guide for new languages

## v1.9.0: Docs, hardening, and stability

- Documentation site (VitePress) on GitHub Pages
- Accessibility audit, memory-leak tests, large-document performance budgets
- Security review (ReDoS fuzzing, dependency licence audit)
- Issue templates, PR template, and a public support policy

---

Have an idea or a use case that isn't covered? [Open an issue](https://github.com/karammm/safetype/issues).
