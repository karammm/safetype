# @safetype/adapters

Add [SafeType.js](https://github.com/karammm/safetype) moderation to the editor you already use.
Every adapter goes through the editor's own API (transactions, deltas, edits). The editor's DOM is never
touched directly, so formatting, undo history and collaboration stay consistent.

```bash
npm install @safetype/adapters
```

| Editor | Import | Highlights | Tested with |
|---|---|---|---|
| Quill 2 | `@safetype/adapters/quill` | message only | 2.0.3 |
| Lexical | `@safetype/adapters/lexical` | message only | 0.52 |
| CodeMirror 6 | `@safetype/adapters/codemirror` | ✅ inline | 6.43 |
| Monaco | `@safetype/adapters/monaco` | ✅ inline + hover | 0.57 |
| ProseMirror | `@safetype/adapters/prosemirror` | ✅ inline | 1.42 |
| Tiptap | `@safetype/adapters/tiptap` (re-exports `@safetype/editor`) | ✅ inline | 3.31 |

Editors are optional peer dependencies, so your app's own copy is always used.

## Usage

```js
// Quill
import { safeTypeQuill } from "@safetype/adapters/quill";
const safeType = safeTypeQuill(quill, { mode: "mask" });

// Lexical
import { safeTypeLexical } from "@safetype/adapters/lexical";
const safeType = safeTypeLexical(editor, { mode: "mask" });

// Monaco
import { safeTypeMonaco } from "@safetype/adapters/monaco";
const safeType = safeTypeMonaco(monacoEditor, { mode: "warn" });

// CodeMirror 6 (an extension)
import { safeTypeCodeMirror } from "@safetype/adapters/codemirror";
const safeType = safeTypeCodeMirror({ mode: "mask" });
new EditorView({ extensions: [basicSetup, safeType.extension], parent });

// ProseMirror (a plugin)
import { safeTypeProseMirror } from "@safetype/adapters/prosemirror";
const safeType = safeTypeProseMirror({ mode: "mask" });
EditorState.create({ schema, plugins: [history(), safeType.plugin] });

// Tiptap
import { SafeTypeModeration } from "@safetype/adapters/tiptap";
new Editor({ extensions: [StarterKit, SafeTypeModeration.configure({ engine: createModerationEngine() })] });
```

The Quill, Lexical and Monaco adapters return `{ getResult(), validate(), destroy(), engine }`.
CodeMirror and ProseMirror return `{ extension | plugin, getResult(view|state), validate(view) }`.

## Behaviour (all adapters)

- A word is moderated once it's **finished**. Paste is moderated immediately, and blur runs a final pass
- **Formatting is kept**: only the characters that change are replaced
- **Undo is respected**: undoing never gets re-masked. Lexical, ProseMirror and Tiptap undo the typing and its mask together
- **IME composition** is never interrupted
- Accessible warning/block message after the editor (`role="status"`, linked with `aria-describedby`).
  Set `messageContainer` to choose where, or `false` to render your own from the callbacks

## Options

All `@safetype/core` engine options (`mode`, `policy`, `languages`, `customWords`, …) plus `engine`, `messages`,
`messageContainer`, `onModerated`, `onViolation` (when violations change), `onWarning`, `onError`.

## Writing an adapter for another editor

Implement the `EditorBinding` contract and let `Moderator` do the rest:

```ts
import { Moderator, type EditorBinding } from "@safetype/adapters";

const binding: EditorBinding = {
  getText: () => myEditor.plainText(),                // blocks separated by "\n"
  getCaret: () => myEditor.collapsedCursorOffset(),   // or null
  applyEdits: (edits, original) => myEditor.transact(edits), // same-offset edits, via the editor's API
  isComposing: () => myEditor.composing,
};
const moderator = new Moderator(binding, { mode: "mask" }, containerElement, editableElement);
myEditor.onChange((change) => moderator.run(change.isUndo ? "observe" : change.isPaste ? "final" : "typing"));
myEditor.onBlur(() => moderator.run("final"));
```

Pull requests for more editors are welcome. Please add real-browser tests in `e2e/`.
