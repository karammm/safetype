# @safetype/editor

A rich-text editor with [SafeType.js](https://github.com/karammm/safetype) moderation built in.
It's built on [Tiptap](https://tiptap.dev) / ProseMirror (MIT) and works without a framework. React, Vue
and Angular wrappers are included in those packages.

```bash
npm install @safetype/editor
```

```js
import { createSafeTypeEditor } from "@safetype/editor";

const editor = createSafeTypeEditor({
  element: document.getElementById("comment"),
  mode: "mask",
  placeholder: "Write something...",
  maxLength: 2000,
  name: "body",                  // hidden input carries the HTML in plain <form> posts
  onChange: ({ html, text }) => save(html),
});
```

Without a bundler: `<script src="https://unpkg.com/@safetype/editor@1/dist/safetype-editor.global.js"></script>`
and use `SafeTypeEditor.createSafeTypeEditor(...)`. The script is about 400 KB minified, Tiptap included.

## Features

- Bold, italic, underline, headings, bulleted/numbered lists, links, undo/redo, placeholder, character count
- **Live moderation through editor transactions.** Only the changed characters are replaced, so bold, links
  and lists survive masking. The word being typed is left alone until it's finished. IME composition and
  undo are respected
- **Inline highlights** for warnings, blocked content, suggestions and items that need review (with `title` explanations)
- **One-click suggestions** in `suggest` mode ("Replace "fuck" with "heck""), plus `applySuggestions()`
- **Accessible:** `role="textbox"` with a label, a toolbar with roving tabindex (arrow keys, Home and End), and a status live region
- **Themes:** `theme: "light" | "dark" | "auto"`, with CSS custom properties on `.safetype-editor`
- **Forms:** `name` adds a hidden input. In `block` mode the surrounding form is stopped
- Links: bare domains get `https://`, and `javascript:`/`data:` links are refused

## Options

All `@safetype/core` engine options (`mode`, `policy`, `customWords`, …) plus `element` (required),
`content`, `placeholder`, `label`, `toolbar` (array of `bold`, `italic`, `underline`, `heading1-3`,
`bulletList`, `orderedList`, `link`, `undo`, `redo`, `"|"`, or `false`), `maxLength`, `showCharacterCount`,
`theme`, `injectStyles`, `engine`, `messages`, `name`, `blockSubmit`, `editable`, `autofocus`,
`requestLink`, and callbacks `onChange`, `onModerated`, `onViolation`, `onWarning`, `onBlocked`, `onFocus`, `onBlur`.

## API

`getHTML()`, `getText()`, `getJSON()`, `setContent()`, `getResult()`, `validate()`, `applySuggestions()`,
`setMode()`, `setPolicy()`, `setEditable()`, `focus()`, `destroy()`, and `editor` (the Tiptap editor).

Advanced: `SafeTypeModeration` is a standalone Tiptap extension you can add to your own Tiptap setup.

## Framework wrappers

```jsx
import { SafeTypeEditor } from "@safetype/react/editor";
<SafeTypeEditor mode="mask" value={html} onChange={setHtml} placeholder="Write something..." />
```

```vue
<script setup> import { SafeTypeEditor } from "@safetype/vue/editor"; </script>
<SafeTypeEditor v-model="html" mode="mask" />
```

```ts
import { SafeTypeEditorComponent } from "@safetype/angular/editor";
// <safe-type-editor [formControl]="body" mode="mask" />   (also ngModel / [(value)])
```

Install `@safetype/editor` next to the framework package.
