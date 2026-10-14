# Changelog

All `@safetype/*` packages share one version number.

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
