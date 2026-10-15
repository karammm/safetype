import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "lexical";
import { characterEdits, MessageRegion, Moderator, type AdapterHandle, type AdapterOptions, type EditorBinding } from "../shared/moderator";

interface Segment {
  key: string;
  start: number;
  end: number;
}

const TAG = "safetype";

/** Plain text of the current editor state with offsets for each TextNode. Must run inside read/update. */
function snapshot(): { text: string; segments: Segment[] } {
  let text = "";
  const segments: Segment[] = [];
  const visit = (node: LexicalNode) => {
    if ($isTextNode(node)) {
      const value = node.getTextContent();
      segments.push({ key: node.getKey(), start: text.length, end: text.length + value.length });
      text += value;
    } else if ($isLineBreakNode(node)) {
      text += "\n";
    } else if ($isElementNode(node)) {
      const block = !node.isInline();
      if (block && text.length > 0 && !text.endsWith("\n")) text += "\n";
      for (const child of node.getChildren()) visit(child);
    } else {
      text += "￼"; // decorators and other leaves
    }
  };
  for (const child of $getRoot().getChildren()) visit(child);
  return { text, segments };
}

/**
 * Moderates a Lexical editor. Masking runs in `editor.update` with `spliceText`, so formatting is kept,
 * and is tagged `history-merge` so undo removes the typing and its mask together.
 *
 * ```js
 * const editor = createEditor({ ... });
 * const safeType = safeTypeLexical(editor, { mode: "mask" });
 * ```
 */
export function safeTypeLexical(editor: LexicalEditor, options: AdapterOptions = {}): AdapterHandle {
  const binding: EditorBinding = {
    getText: () => editor.getEditorState().read(() => snapshot().text),
    getCaret: () =>
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.type !== "text") return null;
        const segment = snapshot().segments.find((s) => s.key === selection.anchor.key);
        return segment ? segment.start + selection.anchor.offset : null;
      }),
    applyEdits(edits, original) {
      editor.update(
        () => {
          const { segments } = snapshot();
          const locate = (offset: number) => segments.find((s) => offset >= s.start && offset < s.end);
          for (const edit of characterEdits(edits, original)) {
            const offset = "char" in edit ? edit.offset : edit.start;
            const segment = locate(offset);
            if (!segment) continue;
            const node = $getNodeByKey(segment.key) as TextNode | null;
            if (!node) continue;
            if ("char" in edit) node.spliceText(offset - segment.start, 1, edit.char, false);
            else node.spliceText(offset - segment.start, Math.min(edit.end, segment.end) - offset, edit.replacement, false);
          }
        },
        { tag: ["history-merge", TAG], discrete: true },
      );
    },
    isComposing: () => editor.isComposing(),
  };

  // Lexical can attach its root element later, so the message region follows registerRootListener.
  const regionFor = (root: HTMLElement | null) =>
    options.messageContainer === false ? null : new MessageRegion(options.messageContainer ?? root, options.messages, root);
  let region = regionFor(editor.getRootElement());
  const moderator = new Moderator(binding, { ...options, messageContainer: false }, null, null);

  const run = (kind: "typing" | "final" | "observe") => {
    const result = moderator.run(kind);
    if (result) region?.update(result);
  };

  const unregister = [
    editor.registerRootListener((next) => {
      region?.clear();
      region = regionFor(next);
      if (moderator.result) region?.update(moderator.result);
    }),
    editor.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves }) => {
      if (tags.has(TAG) || moderator.busy) return;
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return; // selection-only update
      const kind = tags.has("historic") ? "observe" : tags.has("paste") ? "final" : "typing";
      // Never start a nested update from inside an update listener.
      queueMicrotask(() => run(kind));
    }),
    editor.registerCommand(
      BLUR_COMMAND,
      () => {
        queueMicrotask(() => run("final"));
        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
  ];
  run("observe");

  return {
    engine: moderator.engine,
    getResult: () => moderator.result,
    validate() {
      const outcome = moderator.validate();
      region?.update(outcome.result);
      return outcome;
    },
    destroy() {
      for (const fn of unregister) fn();
      moderator.destroy();
      region?.clear();
    },
  };
}

export type { AdapterHandle, AdapterOptions } from "../shared/moderator";
