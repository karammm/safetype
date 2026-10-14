# @safetype/react

React components and hooks for [SafeType.js](https://github.com/karammm/safetype) content moderation.
Works with React 17, 18 and 19, StrictMode, and Next.js (exports are marked `"use client"`).

```bash
npm install @safetype/react
```

## Components

Drop-in replacements for `<input>` and `<textarea>`, controlled or uncontrolled:

```jsx
import { SafeTypeInput, SafeTypeTextarea } from "@safetype/react";

function Chat() {
  const [text, setText] = useState("");
  return <SafeTypeInput mode="mask" value={text} onChange={(e) => setText(e.target.value)} />;
}
// typing "what the fuck " → the field and `text` both become "what the f*ck "
```

- Masking flows through `onChange`, so React state always matches the field
- The caret stays put, and a word is moderated once it's finished
- Warnings render in an accessible live region under the field (`role="status"`, linked with `aria-describedby`)
- `mode="block"` stops the surrounding form's `onSubmit` and sets `aria-invalid`

Props: every normal `input`/`textarea` prop, plus:

| Prop | |
|---|---|
| `mode`, `policy` | Update live |
| `language`, `categories`, `customWords`, `allowList`, `rules`, `maskChar`, `maskStyle`, `classifiers`, … | Engine options, read on mount |
| `engine` | Use a specific engine |
| `messages` | `{ warn, block }` as a string or `(result) => string` |
| `showMessage` | Render the built-in message (default `true`) |
| `unstyled` | Drop the default inline message styles. Style `.safetype-message[data-level]` yourself |
| `blockSubmit` | Stop form submission when blocked (default `true`) |
| `onModeration(result)` | Every result |
| `onViolation`, `onWarning`, `onBlocked` | `(result, element)`. Fire on change, not every keystroke |
| `onModerationError(error)` | Errors from callbacks or classifiers |

## Provider

Share one configuration across the app. Components can still override `mode`:

```jsx
<SafeTypeProvider mode="mask" customWords={["frak"]} policy={{ harassment: { action: "block" } }}>
  <App />
</SafeTypeProvider>
```

## Hooks

```jsx
// Attach to any element you render, including contenteditable
const { ref, result, message, validate } = useSafeType({ mode: "warn" });
<textarea ref={ref} />
{message && <p role="alert">{message.text}</p>}

// Moderate a string during render (previews, chat bubbles, pre-send checks)
const { suggestedText } = useModeration(draft, { mode: "suggest" });

// The provider's engine
const engine = useSafeTypeEngine();
```

`useSafeType` doesn't render messages itself. Use the returned `message`. Call `validate()` before
sending from a chat box that has no `<form>`.

## Notes

- Results and callbacks are delivered right after the browser event finishes. That keeps controlled
  inputs from losing keystrokes. Masking itself is immediate.
- Client-side moderation can be bypassed, so re-check on your server with `@safetype/core`.
