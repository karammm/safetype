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

## v1.0.0: Core engine ✅ (first published as part of 1.5.0)

`@safetype/core`, `@safetype/dictionaries` (English), `@safetype/shared`

- Normalization, obfuscation handling, whole-word matching, context heuristics
- Five actions (allow / mask / suggest / warn / block), per-category policies, confidence thresholds
- Async contextual classifiers with timeout, cancellation, and latest-only sessions
- Offset mapping for caret restoration, idempotent masking
- Node server-side enforcement example, 104 tests, benchmarks


## v1.1.0: Universal DOM integration ✅ (first published as part of 1.5.0)

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

## v1.2.0: React ✅ (first published as part of 1.5.0)

New package: `@safetype/react`

- `useSafeType()` hook, `<SafeTypeInput>`, `<SafeTypeTextarea>`, `<SafeTypeProvider>`
- Works with controlled inputs without fighting React's state
- Example app (Vite) + React Testing Library and Playwright tests

## v1.3.0: Vue ✅ (first published as part of 1.5.0)

New package: `@safetype/vue`

- `v-safe-type` directive, `useSafeType()` composable, `<SafeTypeInput>` component
- Correct `v-model` behaviour + example app and tests

## v1.4.0: Angular ✅ (first published as part of 1.5.0)

New package: `@safetype/angular`

- Standalone `safeType` directive, `SafeTypeService`, compatibility with reactive and template forms
- Built with ng-packagr, plus an example app and tests

## v1.5.0: Built-in rich-text editor ✅ published (npm + PyPI)

New package: `@safetype/editor` (Tiptap / ProseMirror)

- Bold, italic, underline, headings, lists, links, undo/redo, placeholder, character count
- Inline moderation highlights, replacement suggestions, accessible warnings, themes
- Moderation through editor transactions, so formatting is never lost
- Wrappers: `<SafeTypeEditor>` for React, Vue, and Angular

## v1.6.0: Hinglish detection ✅ published

- Romanized Hindi profanity and family-directed insults, on by default; `languages` option to opt out

## v1.7.0: Third-party editor adapters ✅

New package: `@safetype/adapters`

- Tiptap / ProseMirror, Quill, Lexical, CodeMirror 6, Monaco
- A documented adapter contract so the community can add more

## v1.8.0: Contextual AI providers ✅

New package: `@safetype/ai`

- Remote provider for an **app-owned** endpoint (keys stay on your server)
- Optional local in-browser model provider (lazy-loaded, opt-in)
- Custom callback provider
- Server middleware for Express and Fastify, plus a generic `fetch` handler

## v1.9.0: Language packs ✅

- Spanish, French, German, Portuguese and Hindi (Devanagari script; romanized Hinglish shipped in 1.6.0), opt-in
- Engine: Indic vowel signs kept, cluster-aware masking, `ß` = `ss`
- False-positive test suites per pack, shared with the Python port
- A contribution guide for new languages; native-speaker review is invited through issues and PRs

## v1.10.0: Docs, hardening, and stability ✅

- Documentation site (VitePress) at https://karammm.github.io/safetype/docs/, with package pages generated from the READMEs
- axe-core accessibility audits (playground and docs), memory-leak tests, performance budgets
- Fuzzing and adversarial-input tests (JS and Python), dependency licence and vulnerability checks in CI
- Issue templates, PR template, and a public support policy

## v1.11.0: Sexual content and gaali warnings ✅

- New `sexual` category (on by default, warns in `mask` mode): porn, sex, sexting, nude requests ("send nudes",
  "nangi photo bhej"), in English, Hinglish and Hindi
- Hindi gaali such as "bhosada", "lodu", "harami" are masked and also warned about

## v1.12.0: Hinglish and Hindi threats ✅

- Home-invasion and direct threats ("ghar me ghus ke …", "tujhe maar dunga", "tujhe nahi chhodunga") and abusive
  address ("abe saale"), with tests for the innocent look-alikes

## v1.13.0: language pack review ✅

- Answers to the review questions in issues #1-#5: regional words, fewer false positives, Portugal and Québec
- Native speakers can still comment on those issues; their feedback goes into the next releases

## v1.14.0: SolidJS ✅

- `@safetype/solid`: components, the `use:safeType` directive, a provider, primitives and the rich-text editor

---

Have an idea or a use case that isn't covered? [Open an issue](https://github.com/karammm/safetype/issues).
