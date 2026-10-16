# Getting started

SafeType.js finds profanity, hate speech and harassment in text, then masks, suggests a replacement for,
warns about, or blocks it. It runs in the browser as people type and on your server before you save.

## Pick a package

| You want to… | Install |
| --- | --- |
| Moderate every input, textarea and contenteditable on a page | `@safetype/dom` |
| Use components or hooks in React, Vue, Angular or Solid | `@safetype/react`, `@safetype/vue`, `@safetype/angular`, `@safetype/solid` |
| Add a rich-text editor with moderation built in | `@safetype/editor` |
| Moderate an editor you already use | `@safetype/adapters` |
| Check text yourself (Node, Deno, edge, workers) | `@safetype/core` |
| Check text in Python | `pip install safetype` |
| Add contextual AI (Claude or any model) | `@safetype/ai` |

Framework packages include `@safetype/core`, so you install only one package.

## A whole page in two lines

```js
import { createSafeType } from "@safetype/dom";

createSafeType({ mode: "mask" }).start();
```

Every text field, including fields added later, is now moderated as people type:

- The word being typed is left alone until it is finished.
- The caret stays where it was and undo keeps working.
- Password, email and payment fields are never touched.

## Just the engine

```ts
import { createModerationEngine } from "@safetype/core";

const engine = createModerationEngine({ mode: "mask" });

engine.moderate("What the fuck are you doing?").text; // "What the f*ck are you doing?"
engine.moderate("Scunthorpe has a class assassin").matches; // [] (no false positives)
```

## React, Vue, Angular and Solid

::: code-group

```jsx [React]
import { SafeTypeTextarea } from "@safetype/react";

<SafeTypeTextarea mode="mask" value={text} onChange={(e) => setText(e.target.value)} />;
```

```vue [Vue]
<textarea v-safe-type v-model="text" />
```

```html [Angular]
<textarea safeType [(ngModel)]="text"></textarea>
```

```tsx [Solid]
import { SafeTypeTextarea } from "@safetype/solid";

<SafeTypeTextarea mode="mask" value={text()} onValueChange={setText} />;
```

:::

## Always check again on the server

Client-side moderation improves the experience, but anyone can bypass it. Validate submissions with the
same rules before you store them:

```ts
const { valid, result } = engine.validate(req.body.comment);
if (!valid) return res.status(422).json({ error: "Please rephrase your comment." });
save(result.text); // masked text
```

See [Server-side enforcement](./server).

## Next steps

- [How moderation works](./concepts): actions, categories, policies and context.
- [Languages](./languages): turn on Spanish, French, German, Portuguese or Hindi.
- [Custom words and rules](./rules): add your own terms and allow-list false positives.
