# Changelog

All `@safetype/*` packages share one version number.

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
