# @safetype/solid

SolidJS components, primitives and a directive for [SafeType.js](https://github.com/karammm/safetype)
content moderation. Requires Solid 1.8 or later. Works with SolidStart (server rendering included).

```bash
npm install @safetype/solid
```

## Components

```tsx
import { SafeTypeInput, SafeTypeTextarea } from "@safetype/solid";

const [text, setText] = createSignal("");

<SafeTypeInput value={text()} onValueChange={setText} mode="mask" placeholder="Say something" />
<SafeTypeTextarea mode="warn" messages={{ warn: "Please keep it kind" }} onViolation={track} />
```

Masked text comes back through `onValueChange`, so your signal always matches the field. The caret stays put, and a
word is moderated once it's finished. Other props (`class`, `placeholder`, `onInput`, `ref`, …) pass through to the
element.

Props: `mode` and `policy` (live), the other engine options (`customWords`, `language`, …), `engine`, `messages`,
`showMessage`, `unstyled`, `blockSubmit`. Callbacks: `onModeration`, `onViolation`, `onWarning`, `onBlocked`,
`onModerationError`. `apiRef` receives `validate()`, `result()`, `message()`, `focus()` and `element()`.

## Directive

Works on any `<input>`, `<textarea>` or contenteditable element and renders an accessible message after it:

```tsx
import { safeType } from "@safetype/solid";
safeType; // keep the import: TypeScript can't see `use:` usage

<textarea use:safeType />                                  {/* provider or default settings */}
<input use:safeType="block" />                            {/* a mode */}
<div contenteditable use:safeType={{ mode: "warn", onViolation }} />
```

## Provider

```tsx
import { SafeTypeProvider } from "@safetype/solid";

<SafeTypeProvider mode="mask" language="hi" customWords={["frak"]}>
  <App />
</SafeTypeProvider>
```

Every component, primitive and directive below it shares one engine. Give a component its own engine options
(`mode="warn"`) and it gets a private engine that still inherits the provider's settings.

## Primitives

```ts
const [field, setField] = createSignal<HTMLTextAreaElement>();
const { result, message, validate } = useSafeType(field, { mode: "warn" }); // you render message()
// <textarea ref={setField} />

const preview = useModeration(draft, { mode: "suggest" }); // reactive result for any string
const engine = useSafeTypeEngine();                        // the provider's engine
```

Options can be plain objects or functions (`() => ({ mode: mode() })`) for live updates.

## Rich-text editor

```tsx
import { SafeTypeEditor } from "@safetype/solid/editor"; // npm install @safetype/editor

<SafeTypeEditor value={html()} onValueChange={setHtml} mode="mask" placeholder="Write something..." />
```

`apiRef` receives the editor API (`validate()`, `applySuggestions()`, `focus()`, …). See
[`@safetype/editor`](../editor/README.md).

## Notes

- The package ships plain JavaScript (no JSX), so it works with any Solid build setup.
- Block mode stops form submission until the text is fixed.
- Client-side moderation can be bypassed, so re-check on your server with `@safetype/core`.
