# @safetype/dom

Attach [SafeType.js](https://github.com/karammm/safetype) moderation to the text fields on any web page:
`<input>`, `<textarea>` and `contenteditable`. You don't need to replace your forms, components or editor.

```js
import { createSafeType } from "@safetype/dom";

const safeType = createSafeType({ mode: "mask" });
safeType.start();   // every eligible field on the page is moderated
safeType.stop();    // detach (start() can be called again)
safeType.destroy(); // stop for good
```

Without a bundler:

```html
<script src="https://unpkg.com/@safetype/dom@1/dist/safetype.global.js"></script>
<script>SafeType.createSafeType({ mode: "mask" }).start();</script>
```

## Behaviour

| Situation | What happens |
|---|---|
| Typing | A word is moderated once it is finished, so `ass` is not masked while someone types `assassin` |
| Caret / selection | Preserved when text before it is masked |
| Paste, drag-and-drop | Moderated immediately |
| Undo / redo | Never fought: masking uses the browser's editing commands, so undo history stays intact. Undone text is re-checked on the next edit or blur |
| IME composition (CJK, Hindi, etc.) | Nothing is modified until composition ends |
| Blur, form submit | Final pass that masks any pending word |
| Fields added later | Attached automatically (MutationObserver) and detached when removed |
| `contenteditable` | Only the affected characters change, so bold, italic and links are kept. Paragraphs never merge into one word |
| `warn` / `block` | An accessible message (`role="status"`, linked with `aria-describedby`) appears after the field. `block` also sets `aria-invalid` and stops form submission |

### Never moderated

`type="password"`, `email`, `number`, `tel`, `hidden` and every other non-text input type; fields whose
`autocomplete` is a credential, payment, contact or one-time-code value; fields whose `name` or `id`
looks like a password, PIN, OTP, card or IBAN; `readonly` and `disabled` fields; anything inside
`data-safetype="off"`; and editors that own their DOM (ProseMirror/Tiptap, Lexical, Quill, CodeMirror,
Monaco, Slate, Draft.js, CKEditor). Those editors get adapters in a later release.

## Options

All `@safetype/core` engine options (`mode`, `policy`, `customWords`, `classifiers`, …) plus:

| Option | Default | |
|---|---|---|
| `selector` | `"input, textarea, [contenteditable]"` | Which elements to consider |
| `root` | `document` | Scope to an element or an open `ShadowRoot` |
| `engine` | | Reuse an existing `createModerationEngine()` instance |
| `observeDynamicElements` | `true` | Watch for fields added later |
| `excludeSelectors` | `[]` | Extra selectors to skip |
| `showMessages` | `true` | Render warning/block messages |
| `messages` | | `{ warn, block }` as a string or `(result) => string` |
| `injectStyles` | `true` | Tiny default stylesheet for messages (`.safetype-message`) |
| `blockSubmit` | `true` | Prevent submission of forms containing blocked content |
| `asyncModeration` | `true` if `classifiers` are set | Run contextual classifiers after typing pauses |
| `asyncDebounceMs` | `300` | |

## Events

Callbacks receive `(result, element)`, and the same events are dispatched on the element as DOM events:

| Callback | DOM event | Fires |
|---|---|---|
| `onModerated` | `safetype:moderated` | After every moderation pass |
| `onViolation` | `safetype:violation` | When a field's set of violations **changes** (not on every keystroke) |
| `onWarning` | `safetype:warning` | When a new warning appears |
| `onBlocked` | `safetype:blocked` | When a form submission is prevented |
| `onError` | | Errors from callbacks or classifiers |

```js
document.addEventListener("safetype:violation", (event) => {
  analytics.track("moderation", { categories: event.detail.result.matches.map((m) => m.category) });
});
```

## Methods

`start()`, `stop()`, `destroy()`, `attach(el)`, `detach(el)`, `getResult(el)`,
`validate()` → `{ valid, results }`, `elements`, `running`, `engine`.

## Limitations

- Cross-origin iframes, closed shadow roots and canvas-based editors (e.g. Google Docs) can't be reached.
- Enter-to-send chat boxes that don't use a `<form>` aren't blocked automatically. Call `validate()` in your send handler.
- Client-side moderation can be bypassed. Re-check on your server with `@safetype/core`'s `validate()`.
