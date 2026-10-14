# Changelog

All `@safetype/*` packages share one version number.

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
