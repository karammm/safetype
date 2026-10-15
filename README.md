<p align="center">
  <a href="https://karammm.github.io/safetype/docs/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
      <img src="docs/assets/logo-light.svg" alt="SafeType.js" width="300">
    </picture>
  </a>
</p>

<p align="center">
  <strong>Write freely. Communicate respectfully.</strong><br>
  Open-source moderation for profanity, hate speech, harassment and sexual content, in any text field or editor, as people type.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@safetype/core"><img src="https://img.shields.io/npm/v/@safetype/core?label=npm&color=0a7a6b" alt="npm version"></a>
  <a href="https://pypi.org/project/safetype/"><img src="https://img.shields.io/pypi/v/safetype?label=pypi&color=0a7a6b" alt="PyPI version"></a>
  <a href="https://github.com/karammm/safetype/actions/workflows/ci.yml"><img src="https://github.com/karammm/safetype/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://karammm.github.io/safetype/docs/guide/security#supply-chain"><img src="https://img.shields.io/badge/npm-provenance-0a7a6b" alt="npm provenance"></a>
  <a href="https://karammm.github.io/safetype/docs/guide/accessibility"><img src="https://img.shields.io/badge/WCAG_2.2-AA_audited-0a7a6b" alt="WCAG 2.2 AA audited"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://karammm.github.io/safetype/docs/"><b>Documentation</b></a> ·
  <a href="https://karammm.github.io/safetype/"><b>Playground</b></a> ·
  <a href="https://github.com/karammm/safetype/discussions"><b>Discussions</b></a> ·
  <a href="CHANGELOG.md"><b>Changelog</b></a> ·
  <a href="ROADMAP.md"><b>Roadmap</b></a>
</p>

<p align="center">
  <a href="docs/assets/safetype-intro.mp4">
    <img src="docs/assets/safetype-intro.gif" width="820"
      alt="SafeType.js in 45 seconds: live masking while typing, catching disguised spellings without flagging innocent words, context-aware handling of harassment, and the five moderation actions">
  </a>
  <br>
  <sub>▶ <a href="docs/assets/safetype-intro.mp4">Watch the 45-second intro in full quality</a>. Every result shown is real output.</sub>
</p>

---

## Quick start

```bash
npm install @safetype/dom
```

```js
import { createSafeType } from "@safetype/dom";

createSafeType({ mode: "mask" }).start(); // every input, textarea and contenteditable on the page
```

Or use the engine directly, in the browser, Node, Deno, Bun, workers or the edge:

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ mode: "mask" });

engine.moderate("What the fuck are you doing?").text; // "What the f*ck are you doing?"
engine.moderate("Scunthorpe has a class assassin").matches; // [] (no false positives)
```

## Why SafeType

- **Works with what you already have.** Plain inputs, React, Vue, Angular, or your existing editor (Quill, Lexical,
  CodeMirror, Monaco, ProseMirror, Tiptap). Nothing to replace.
- **Five actions, not just a filter.** Mask, suggest a friendlier word, warn, block, or only report, with policies per
  category.
- **Hard to fool, kind to innocent words.** It catches `sh1t`, `fuuuck`, `f u c k`, lookalike letters and zero-width
  tricks, and whole-word matching means no Scunthorpe problem.
- **Honest about hate speech.** Profanity is masked deterministically. Hate, harassment and sexual content are
  confidence-scored signals that quotes and reported speech can weaken, and borderline cases go to review instead
  of being punished.
- **A good typing experience.** The word being typed is left alone, the caret never jumps, undo keeps working, IME
  input is respected, and password and payment fields are never touched.
- **Private by default.** It runs locally, with no telemetry. Text only leaves the device if you add a classifier
  that calls your own server.
- **The same rules on your server.** Re-check submissions in Node or Python. Both are tested against the same
  2,000+ recorded results.
- **Optional AI.** Add Claude or any model for sarcasm, coded insults and threats without swear words. API keys stay
  on your server.

## Install

| You want to… | Install |
| --- | --- |
| Moderate every text field on a page | `npm i @safetype/dom` |
| Use components and hooks | `npm i @safetype/react` · `@safetype/vue` · `@safetype/angular` |
| Add a rich-text editor with moderation built in | `npm i @safetype/editor` |
| Moderate the editor you already use | `npm i @safetype/adapters` |
| Check text yourself (any JavaScript runtime) | `npm i @safetype/core` |
| Check text in Python | `pip install safetype` |
| Add contextual AI moderation | `npm i @safetype/ai` |

Each framework package includes the engine, so you only install one package.

## Usage

<details open>
<summary><b>React</b></summary>

```jsx
import { SafeTypeTextarea } from "@safetype/react";

<SafeTypeTextarea mode="mask" value={text} onChange={(e) => setText(e.target.value)} />;
```

Masked text flows through `onChange`, so your state always matches the field. Hooks: `useSafeType`, `useModeration`.
[React docs →](https://karammm.github.io/safetype/docs/packages/react)

</details>

<details>
<summary><b>Vue</b></summary>

```vue
<textarea v-safe-type v-model="text" />
<!-- or <SafeTypeTextarea v-model="text" /> -->
```

[Vue docs →](https://karammm.github.io/safetype/docs/packages/vue)

</details>

<details>
<summary><b>Angular</b></summary>

```html
<textarea safeType [(ngModel)]="text"></textarea>
<!-- also reactive forms, a validator, a pipe and SafeTypeService -->
```

[Angular docs →](https://karammm.github.io/safetype/docs/packages/angular)

</details>

<details>
<summary><b>Built-in rich-text editor</b></summary>

```js
import { createSafeTypeEditor } from "@safetype/editor";

createSafeTypeEditor({ element, mode: "mask", placeholder: "Write something…", maxLength: 2000 });
```

Formatting, links, lists, undo, inline highlights and one-click suggestions, and masking keeps formatting. It's also
available as `<SafeTypeEditor>` for React and Vue and `<safe-type-editor>` for Angular.
[Editor docs →](https://karammm.github.io/safetype/docs/packages/editor)

</details>

<details>
<summary><b>Quill, Lexical, CodeMirror, Monaco, ProseMirror, Tiptap</b></summary>

```js
import { safeTypeQuill } from "@safetype/adapters/quill";

safeTypeQuill(quill, { mode: "mask" });
```

Each adapter edits through the editor's own API, so formatting and undo keep working.
[Adapter docs →](https://karammm.github.io/safetype/docs/packages/adapters)

</details>

<details>
<summary><b>Server-side enforcement (Node and Python)</b></summary>

Client-side moderation can always be bypassed, so re-check before you store:

```ts
const engine = createModerationEngine({ policy: { hate: { action: "block" }, harassment: { action: "block" } } });

const { valid, result } = engine.validate(req.body.text);
if (!valid) return res.status(422).json({ error: "Please rephrase." });
save(result.text); // profanity masked
```

```python
from safetype import create_moderation_engine

engine = create_moderation_engine(policy={"hate": {"action": "block"}, "harassment": {"action": "block"}})
check = engine.validate(text)
```

[Server guide →](https://karammm.github.io/safetype/docs/guide/server)

</details>

<details>
<summary><b>Contextual AI (Claude or any model)</b></summary>

```ts
// server: keys stay here
const service = createModerationService({ classifiers: [anthropicClassifier({ client: new Anthropic() })] });
app.post("/api/safetype/classify", express.json(), expressClassifier(service));

// browser
createSafeType({ classifiers: [remoteClassifier({ endpoint: "/api/safetype/classify" })] }).start();
```

If the model is slow or fails, results fall back to the rules. [AI docs →](https://karammm.github.io/safetype/docs/packages/ai)

</details>

## How it works

```
normalize → tokenize → match rules → score context → apply policy → transform
```

| Mode | Result | Typical use |
| --- | --- | --- |
| `mask` | `What the f*ck` | Chat, comments |
| `suggest` | Offers "heck" | Writing assistants |
| `warn` | Accessible message, text unchanged | Community guidelines |
| `block` | `allowed: false`, submit stopped | Strict spaces, server enforcement |
| `allow` | Report only | Analytics, review queues |

Policies can differ per category. For example, you can mask profanity while blocking harassment:

```ts
createModerationEngine({ mode: "mask", policy: { harassment: { action: "block", minConfidence: 0.7 } } });
```

[How moderation works →](https://karammm.github.io/safetype/docs/guide/concepts) ·
[Engine API →](https://karammm.github.io/safetype/docs/guide/api) ·
[Custom words and rules →](https://karammm.github.io/safetype/docs/guide/rules)

## Languages

| English | Hinglish | हिन्दी | Español | Français | Deutsch | Português |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| default | default | opt-in | opt-in | opt-in | opt-in | opt-in |

```ts
createModerationEngine({ languages: ["en", "es", "fr"] });
```

Every pack is tested against everyday sentences that must stay clean ("Ihr Hund ist süß", "Compré un cono de helado",
"हम लड़ रहे हैं"). **Native speakers:** please help
[review a language](https://github.com/karammm/safetype/issues?q=is%3Aissue+is%3Aopen+label%3A%22native+speaker+review%22).
No code needed. [Languages guide →](https://karammm.github.io/safetype/docs/guide/languages)

## Packages

| Package | Version | Description |
| --- | --- | --- |
| [`@safetype/core`](https://karammm.github.io/safetype/docs/packages/core) | [![npm](https://img.shields.io/npm/v/@safetype/core?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/core) | The engine: browsers, Node, Deno, Bun, edge |
| [`@safetype/dom`](https://karammm.github.io/safetype/docs/packages/dom) | [![npm](https://img.shields.io/npm/v/@safetype/dom?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/dom) | Inputs, textareas and contenteditable, auto-attached |
| [`@safetype/react`](https://karammm.github.io/safetype/docs/packages/react) | [![npm](https://img.shields.io/npm/v/@safetype/react?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/react) | Components and hooks |
| [`@safetype/vue`](https://karammm.github.io/safetype/docs/packages/vue) | [![npm](https://img.shields.io/npm/v/@safetype/vue?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/vue) | Directive, components and composables |
| [`@safetype/angular`](https://karammm.github.io/safetype/docs/packages/angular) | [![npm](https://img.shields.io/npm/v/@safetype/angular?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/angular) | Directive, validator, pipe and service |
| [`@safetype/editor`](https://karammm.github.io/safetype/docs/packages/editor) | [![npm](https://img.shields.io/npm/v/@safetype/editor?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/editor) | Built-in rich-text editor (Tiptap) |
| [`@safetype/adapters`](https://karammm.github.io/safetype/docs/packages/adapters) | [![npm](https://img.shields.io/npm/v/@safetype/adapters?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/adapters) | Quill, Lexical, CodeMirror, Monaco, ProseMirror, Tiptap |
| [`@safetype/ai`](https://karammm.github.io/safetype/docs/packages/ai) | [![npm](https://img.shields.io/npm/v/@safetype/ai?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/ai) | Contextual AI providers and server handlers |
| [`@safetype/dictionaries`](https://karammm.github.io/safetype/docs/packages/dictionaries) | [![npm](https://img.shields.io/npm/v/@safetype/dictionaries?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/dictionaries) | Language packs and the pack format |
| [`@safetype/shared`](packages/shared) | [![npm](https://img.shields.io/npm/v/@safetype/shared?label=&color=0a7a6b)](https://www.npmjs.com/package/@safetype/shared) | Shared TypeScript types |
| [`safetype`](https://karammm.github.io/safetype/docs/packages/python) (Python) | [![PyPI](https://img.shields.io/pypi/v/safetype?label=&color=0a7a6b)](https://pypi.org/project/safetype/) | The engine for Python 3.9+ |

All packages share one version number. The whole browser bundle, with every language, is **19 KB gzipped**.

## Quality

Every push is checked in CI with:

- Unit tests on Node 18–24 and Python 3.9–3.13, with JS↔Python parity on 2,000+ recorded results.
- Real-browser tests in Chromium, Firefox and WebKit for every package, adapter and example app.
- [Accessibility audits](https://karammm.github.io/safetype/docs/guide/accessibility) (axe-core, WCAG 2.2 AA) of
  the playground and every docs page.
- [Fuzzing, ReDoS and performance tests](https://karammm.github.io/safetype/docs/guide/performance): about 12,000
  random inputs, a linear-time check, and budgets for large documents and typing.
- Memory-leak tests confirming destroyed instances and editors are garbage-collected.
- [Supply chain](https://karammm.github.io/safetype/docs/guide/security#supply-chain) checks: permissive licences
  only, no known vulnerabilities, no install scripts, and npm provenance on every release.

> [!IMPORTANT]
> Rule-based detection misses new spellings, coded language and sarcasm, and can flag reclaimed or quoted words.
> Treat hate and harassment results as signals for review, not verdicts, and always enforce on the server.
> [Limitations →](https://karammm.github.io/safetype/docs/guide/faq)

## Community

- **Questions and ideas:** [GitHub Discussions](https://github.com/karammm/safetype/discussions)
- **Missed words, false positives, bugs:** [open an issue](https://github.com/karammm/safetype/issues/new/choose)
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and releases. Native-speaker reviews of the
  [language packs](https://github.com/karammm/safetype/issues?q=is%3Aissue+is%3Aopen+label%3A%22native+speaker+review%22)
  are especially welcome.
- **Security:** please report vulnerabilities [privately](https://github.com/karammm/safetype/security/advisories/new),
  as described in [SECURITY.md](SECURITY.md)
- **Support policy:** [SUPPORT.md](SUPPORT.md) · **Code of conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE) © SafeType.js contributors
