# Changelog

All `@safetype/*` packages share one version number.

## 1.13.0

### Language pack review ([#1](https://github.com/karammm/safetype/issues/1) to [#5](https://github.com/karammm/safetype/issues/5))

- **Spanish:** Argentina, Chile and Peru (*boludo*, *pelotudo*, *huevón*, *weón*), only when aimed at someone, so
  "che boludo" between friends stays clean; *conchudo*, *mamagüevo*, *malnacido*; *usted*/*tú*/*vos* subjects; more
  threat verbs. *chingón* (awesome in Mexico) is no longer flagged; *culo* is now `low`, *culero* `high`
- **French:** Québec sacres (*tabarnak*, *câlisse*, *ostie*); SMS forms *ntm*, *ftg*, *fdp*. *bâtard* (also a bread)
  and *pédé* are flagged only when aimed at someone ("sale pédé", "t'es un bâtard")
- **German:** Austria and Switzerland (*Oaschloch*, *Gschissener*, *Beidl*, *Huerebueb*; a bare Swiss *huere* is an
  intensifier and stays clean); *Kuh*, *Affe*, *Esel*, *Ratte*, *Wappler* only in direct address ("du blöde Kuh")
- **Portuguese:** Portugal (*cona*, *cabrão*, *badalhoco*, the slur *paneleiro*); *fuder* spellings; *tmnc*, *vtmnc*.
  A bare *puto* (kid in Portugal) is no longer flagged; *fds* (also "weekend") is left out
- **Hindi and Hinglish:** *छिनाल* / *chhinal*, *दल्ला*; "कुत्ते की औलाद" / "kutte ki aulad" (but not "kutte ka baccha", a
  puppy); *हिजड़ा* only as "तू हिजड़ा है", never in "हिजड़ा समुदाय"
- Every change has tests for the innocent look-alikes, and the Python parity fixtures cover the new sentences

## 1.12.0

### Hinglish and Hindi threats

- Threats are now warned about (`harassment`, label `threat`), in romanized Hinglish and Devanagari:
  - breaking into someone's home: "ghar me ghus ke chodunga", "ghar aake maarunga", "घर में घुस के मारूंगा"
  - direct threats: "tujhe maar dunga", "tujhe jaan se maar daalunga", "tereko khatam kar dunga", "tujhe chodunga"
  - "tujhe nahi chhodunga" (I won't spare you), "तुझे नहीं छोड़ूंगा"
- Abusive address is warned about: "abe saale", "saale kutte", "oye kamine", "अबे साले"
- No new false positives: "kal main ghar chodunga" (I'll leave home), "mere saale ki shaadi hai" (brother-in-law),
  "ghar me ghus ke dekha" and "tujhe ghar chhod dunga" stay clean, and are covered by tests
- Python port updated (parity cases include the new sentences)

## 1.11.0

### New: `sexual` category

- Sexual content and solicitation are detected and **warned about** (not masked) in `mask` mode: "porn", "pornhub",
  "sex", "sexting", "seggs", "horny", "nudes", "send nudes", "send me your nudes", "show me nude pics", "dick pics",
  and in Hinglish and Hindi "nangi photo bhej", "पोर्न", "नंगी फोटो भेज"
- On by default. It follows the mode (`block` blocks it) and can be turned off with
  `policy: { sexual: { action: "allow" } }` or `categories`
- Deliberately not flagged: "sexy", "nude" (as in art), "xxx", and words containing "sex" (Essex, unisex)
- The default warning reads "This may not be appropriate here" when only sexual content is flagged
- `ModerationCategory` gains `"sexual"`. If you `switch` over categories exhaustively, add a case
- `@safetype/ai`: the LLM classifier can report `sexual` findings

### Hinglish and Hindi gaali warn as well as mask

- "bhosada", "bhosdike", "lodu", "harami", "haramkhor" and their Devanagari spellings are still masked, and now also
  show a warning as insults (`hi-latn.harassment.gaali`, `hi.harassment.gaali`)

### Python

- Same changes in the `safetype` package, checked against 2,622 parity cases

## 1.10.0

### Documentation site

- **https://karammm.github.io/safetype/docs/**: getting started, how moderation works, the engine API, languages,
  custom rules, server-side enforcement, accessibility, performance, security, FAQ and the support policy
- Package reference pages are generated from the package READMEs, so the site always matches what's published.
  The examples shown are checked by tests

### Fixes

- **Masking:** a word whose only maskable character was a trailing leet digit (e.g. "चूतिया0") was masked twice
  across passes. Vowel masking now falls back to partial masking unless it masks something before the last
  character. Found by the new fuzzing tests. Fixed in JavaScript and Python
- **Playground:** three colour-contrast failures (links and the selected mode button) now meet WCAG AA

### Quality and hardening (CI)

- Fuzzing: about 9,000 random inputs (JS) and 3,000 (Python) per run, checking the engine never throws, offsets stay
  valid and masking is idempotent
- Adversarial inputs at two sizes must scale linearly (no ReDoS), and performance budgets cover 100 KB documents,
  1,000 messages and per-keystroke re-checks
- Memory-leak tests (Chromium): destroyed `createSafeType` instances, removed fields and destroyed editors are
  garbage-collected, and `stop()`/`destroy()` remove every listener
- axe-core accessibility audits (WCAG 2.2 A/AA) of the playground and every docs page, in light and dark mode, in
  Chromium, Firefox and WebKit, plus phone-width checks
- Licence check (permissive only) and `pnpm audit` on production dependencies
- Example and dev dependency: Vue 3.5.13 → 3.5.43 (fixes GHSA-g2v6-rqmx-r4w6 in `@vue/server-renderer`; not part of
  any published package)

### Community

- Issue forms (missed word or false positive, bug, language, feature), a PR template, `SUPPORT.md`, and supported
  versions in `SECURITY.md`

## 1.9.0

### Language packs (`@safetype/dictionaries`)

- **Spanish (`es`), French (`fr`), German (`de`), Portuguese (`pt`) and Hindi in Devanagari (`hi`)**: profanity,
  a small list of unambiguous slurs, group-violence statements, and harassment phrases (insults in direct address,
  self-harm incitement, threats)
- **Opt-in:** existing apps see no change. Enable with `languages: ["en", "es"]`, `language: "pt-BR"`, or
  `language: "hi"` (Devanagari + Hinglish). `language: "hi-Latn"` stays romanized-only
- Each pack documents the words it deliberately leaves out (e.g. "coño"/"cono", "con", "Ihr Hund", "लड़"),
  backed by false-positive tests
- Subpath imports: `@safetype/dictionaries/es`, `/fr`, `/de`, `/pt`, `/hi`

### `@safetype/core` and the Python port

- Indic combining marks (vowel signs, virama, nukta) are kept during normalization, so "लंड" no longer equals "लड़".
  Candrabindu and anusvara are treated as the same ("माँ" = "मां")
- Masking works on whole characters (base + combining marks): "चूतिया" → "चू*या", with no stray vowel signs
- `ß` matches `ss`
- The Python port mirrors all of the above and passes the same 1,995 parity cases

### Playground

- Language picker and an "Other languages" sample

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
