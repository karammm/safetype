# Changelog

All `@safetype/*` packages share one version number.

## 1.8.0

### New: `@safetype/ai`

- **Contextual AI moderation, opt-in and server-side.** It catches coded insults, threats without swear words and
  dehumanising statements, and lowers false positives for quoted or reported speech
- `anthropicClassifier` (`@safetype/ai/anthropic`): Claude via the official SDK, using `claude-opus-5-5` at low effort,
  structured JSON output, a cached system prompt, and server-side fallbacks. A refusal falls back to rule-based results
- `llmClassifier({ complete })` for any other model. Findings must quote the text. Malformed or ungrounded answers are dropped
- `remoteClassifier` for browsers: calls your endpoint, so keys never reach the client
- `localModelClassifier` for in-browser models (e.g. Transformers.js), bring your own
- `@safetype/ai/server`: `createModerationService` (validation, size limit, `authorize`, caching, timeouts, 502 on failure),
  `expressClassifier` / `expressGuard`, `fastifySafeType` / `fastifyGuard`, and `createFetchHandler`
- Prompt-injection hardening: delimited input, grounded findings, and `adjust: "raise-only" | "none"`
- Example: `examples/ai-server`

### `@safetype/core`

- Multi-word hate/harassment findings from contextual classifiers warn instead of mask, like multi-token rules

## 1.7.0

### New: `@safetype/adapters`

- Moderation for editors apps already use, through each editor's own API:
  - **Quill 2:** one `updateContents` delta per pass, keeping each character's formatting
  - **Lexical:** `spliceText` in a `history-merge` update, so undo removes the typing and its mask together
  - **CodeMirror 6:** a single transaction per pass, plus inline highlight decorations
  - **Monaco:** `executeEdits` (undoable), plus inline highlights with hover explanations
  - **ProseMirror:** a plugin with decorations and transaction-based masking
  - **Tiptap:** re-export of the `@safetype/editor` extension
- Same behaviour everywhere: words are moderated once finished, paste immediately, a final pass on blur,
  undo never re-masked, IME-safe, accessible messages, `onViolation`/`onWarning` callbacks
- Documented `EditorBinding` contract + `Moderator` for adding more editors
- Editors are optional peer dependencies. Tested in real browsers with Quill 2.0.3, Lexical 0.52, CodeMirror 6.43,
  Monaco 0.57 and ProseMirror 1.42

## 1.6.0

### Hinglish (romanized Hindi) detection, on by default

- New `hi-Latn` pack: behenchod, madarchod, betichod, chut, lund/loda/lauda, lodu/loduchand, bhosda/bhosdike/bhosidke,
  bsdk/bkl/mkc, chutiya, gandu/gaand, harami, bhadwa, jhaatu, kutiya, randiya/randibaaz, with common spelling variants.
  Repeated letters, leet (`bh3nch0d`) and spaced letters are handled like English
- Insults aimed at someone's family ("teri maa ka bhosada", "maa chod") are flagged as **harassment** (warn by default),
  while the swear word inside is still masked
- Left out on purpose to avoid false positives: `bc`, `mc`, `bkc`, `kutti`, bare `randi`, `gand`, and "chod" on its own
  ("mujhe chod do"). Checked against 235,976 English words: the only collisions are "chut" (French) and the place name "Lund"
- New `languages` option (JS and Python): the default for English is `["en", "hi-Latn"]`. Use `languages: ["en"]` to turn Hinglish off
- `@safetype/dictionaries/hi-latn` export. The Python package ships the same pack, and parity now covers 966 cases

## 1.5.1

- First release published from GitHub Actions through npm and PyPI trusted publishing. npm packages now
  carry provenance attestations that link each version to the commit and workflow that built it.
- No code changes from 1.5.0.

## 1.5.0

### New: `@safetype/editor`

- `createSafeTypeEditor()`: a Tiptap 3 / ProseMirror rich-text editor with bold, italic, underline, headings,
  lists, links, undo/redo, placeholder and character count
- Moderation through editor transactions: only changed characters are replaced, so formatting survives masking.
  Word-under-cursor deferral, IME-safe, and undo-friendly (masking is grouped with the typing)
- Inline highlights, an accessible status region, one-click replacement suggestions, and `applySuggestions()`
- Accessible toolbar (roving tabindex), light/dark/auto themes, hidden input for form posts, form blocking
- Link safety: bare domains get `https://`, and script-capable schemes are refused
- `SafeTypeModeration` Tiptap extension for custom Tiptap setups
- Browser bundle (`window.SafeTypeEditor`), and the editor is added to the playground

### New: `safetype` on PyPI

- Python port of the engine (Python 3.9+, no dependencies) for server-side validation in Django, FastAPI or Flask
- Uses the dictionary JSON exported from the JavaScript build, and replays 684 cases recorded from the JS
  engine in its tests, so results are identical. CI fails if the data drifts

### Release tooling

- `scripts/publish-npm.mjs` publishes all packages in order, idempotently. GitHub Actions publish npm and PyPI on
  `v*` tags with trusted publishing (no stored tokens, npm provenance)

### Wrappers

- `@safetype/react/editor`: `<SafeTypeEditor>` (controlled or uncontrolled, ref API)
- `@safetype/vue/editor`: `<SafeTypeEditor v-model>`
- `@safetype/angular/editor`: `<safe-type-editor>` form control (ngModel / formControl / disabled).
  Calls `markForCheck()` so bindings update in zoneless apps

## 1.4.0

### New: `@safetype/angular`

- Standalone `safeType` directive for inputs, textareas and contenteditable, compatible with `ngModel`, `formControl` and `formControlName`
- Inputs for mode, policy, messages and behaviour, live updates, outputs, and `exportAs: "safeType"` (`result`, `validate()`)
- `safeTypeValidator()` for reactive and template-driven forms
- `safeType` pipe for masking or suggesting when displaying stored content
- `SafeTypeService` and `provideSafeType()`
- Built with ng-packagr (partial Ivy). Verified in Angular 19 (zone.js) and Angular 22 (zoneless) apps
- Angular 22 example app and real-browser tests against the production build

### Tooling

- CI: packages tested on Node 18, 20, 22 and 24. Examples and real-browser tests run on Node 24

## 1.3.0

### New: `@safetype/vue`

- `SafeTypePlugin`: app-wide engine, global `v-safe-type`, `<SafeTypeInput>`, `<SafeTypeTextarea>`
- `v-safe-type` directive for inputs, textareas and contenteditable, `v-model`-compatible, with a mode shorthand (`v-safe-type:block`)
- Components with `v-model`, attribute/listener pass-through, accessible messages and emitted events
- `useSafeType()`, `useModeration()`, `provideSafeType()`, `useSafeTypeEngine()`
- Live `mode` / `policy` updates. Verified with Vue 3.3 and 3.5
- Safe with `v-if`/`v-else`: message cleanup waits until Vue finishes patching
- Vite example app and real-browser tests with a Vue app

### `@safetype/core`

- New exports: `ENGINE_CONFIG_KEYS` and `pickEngineConfig()`, shared by the framework packages

## 1.2.0

### New: `@safetype/react`

- `<SafeTypeInput>` and `<SafeTypeTextarea>`: controlled or uncontrolled, with masked text flowing through `onChange`
- Built-in accessible messages (always-present live region, `aria-describedby`, `aria-invalid` when blocked)
- `<SafeTypeProvider>` for app-wide configuration; components can override `mode`
- `useSafeType()` for any element (including contenteditable), `useModeration()` for strings, `useSafeTypeEngine()`
- Live `mode` / `policy` updates, StrictMode-safe, `"use client"` for Next.js
- Vite example app and real-browser tests with a controlled React app

### Fixed

- All bundles are now ASCII-only. Raw Unicode in a regular expression made `@safetype/core` crash with
  "Invalid regular expression" when a page served the script without a UTF-8 charset. CI now checks every bundle.

### `@safetype/dom`

- When `root` is a single element, form submission is still blocked (the listener is on its document)
- New exports: `getMessageLevel()` and `resolveMessage()`

## 1.1.0

### New: `@safetype/dom`

- `createSafeType()` attaches moderation to inputs, textareas and contenteditable elements, including ones added later
- Live masking that waits for the word under the caret to be finished, and preserves the caret and selection
- Paste, drag-and-drop, IME composition, and undo/redo-safe editing via the browser's editing commands
- Formatting-preserving edits in contenteditable
- Sensitive-field exclusion (passwords, payment, contact, one-time codes, `data-safetype="off"`, editor-managed DOM)
- Accessible warning/block messages, form submission blocking, DOM events and callbacks
- Optional contextual classifiers after typing pauses, with stale-result protection
- Self-contained browser bundle (`window.SafeType`) for `<script>` tags and CDNs
- Live playground and a vanilla JS example

### Other

- Every package exports `./package.json`
- Real-browser tests (Playwright: Chromium, Firefox, WebKit) in CI

## 1.0.0

- `@safetype/core`: moderation engine with normalization, obfuscation handling, context heuristics, five actions,
  per-category policies, async classifiers, offset mapping and server-side `validate()`
- `@safetype/dictionaries`: English pack
- `@safetype/shared`: public TypeScript contracts
