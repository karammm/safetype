import { characterEdits, Moderator, type AdapterHandle, type AdapterOptions, type EditorBinding } from "../shared/moderator";

type Op = { insert?: unknown; retain?: number; delete?: number; attributes?: Record<string, unknown> };

/** The parts of a Quill 2 instance the adapter uses (structural, so Quill is not imported). */
export interface QuillLike {
  root: HTMLElement;
  container: HTMLElement;
  getContents(): { ops: Op[] };
  getSelection(focus?: boolean): { index: number; length: number } | null;
  setSelection(index: number, length: number, source?: string): void;
  updateContents(delta: Op[] | { ops: Op[] }, source?: string): unknown;
  hasFocus(): boolean;
  on(event: string, handler: (...args: never[]) => void): unknown;
  off(event: string, handler: (...args: never[]) => void): unknown;
  composition?: { isComposing: boolean };
}

const EMBED = "￼"; // embeds (images, videos) occupy one index in Quill

/**
 * Moderates a Quill 2 editor. Edits go through `updateContents`, keeping each character's formatting,
 * and are recorded in Quill's undo history.
 *
 * ```js
 * const quill = new Quill("#editor", { theme: "snow" });
 * const safeType = safeTypeQuill(quill, { mode: "mask" });
 * ```
 */
export function safeTypeQuill(quill: QuillLike, options: AdapterOptions = {}): AdapterHandle {
  const read = () => {
    let text = "";
    const attrs: Array<Record<string, unknown> | undefined> = [];
    for (const op of quill.getContents().ops) {
      const value = typeof op.insert === "string" ? op.insert : EMBED;
      text += value;
      for (let i = 0; i < value.length; i++) attrs.push(op.attributes);
    }
    return { text, attrs };
  };

  const binding: EditorBinding = {
    getText: () => read().text,
    getCaret() {
      if (!quill.hasFocus()) return null;
      const range = quill.getSelection();
      return range && range.length === 0 ? range.index : null;
    },
    applyEdits(edits, original) {
      const { attrs } = read();
      const selection = quill.hasFocus() ? quill.getSelection() : null;
      const pieces = characterEdits(edits, original)
        .map((e) => ("char" in e ? { start: e.offset, end: e.offset + 1, text: e.char } : { start: e.start, end: e.end, text: e.replacement }))
        .sort((a, b) => a.start - b.start);
      const ops: Op[] = [];
      let cursor = 0;
      for (const piece of pieces) {
        if (piece.start > cursor) ops.push({ retain: piece.start - cursor });
        ops.push({ delete: piece.end - piece.start });
        const attributes = attrs[piece.start];
        ops.push(attributes ? { insert: piece.text, attributes } : { insert: piece.text });
        cursor = piece.end;
      }
      quill.updateContents(ops, "api");
      if (selection) quill.setSelection(selection.index, selection.length, "silent");
    },
    isComposing: () => quill.composition?.isComposing === true,
  };

  const moderator = new Moderator(binding, options, quill.container, quill.root);
  let history = false;

  const onKeyDown = (event: KeyboardEvent) => {
    // Quill reports undo/redo as ordinary "user" changes; remember the shortcut so we don't re-mask it.
    if ((event.metaKey || event.ctrlKey) && (event.key === "z" || event.key === "Z" || event.key === "y")) history = true;
  };
  const onTextChange = (delta: { ops: Op[] }) => {
    if (moderator.busy) return;
    const inserted = delta.ops.reduce((n, op) => n + (typeof op.insert === "string" ? op.insert.length : 0), 0);
    const kind = history ? "observe" : inserted > 1 ? "final" : "typing";
    history = false;
    moderator.run(kind);
  };
  const onSelectionChange = (range: unknown) => {
    if (range === null) moderator.run("final"); // blur
  };
  const onCompositionEnd = () => setTimeout(() => moderator.run("typing"), 0);

  quill.root.addEventListener("keydown", onKeyDown, true);
  quill.root.addEventListener("compositionend", onCompositionEnd);
  quill.on("text-change", onTextChange as never);
  quill.on("selection-change", onSelectionChange as never);
  moderator.run("observe");

  return {
    engine: moderator.engine,
    getResult: () => moderator.result,
    validate: () => moderator.validate(),
    destroy() {
      quill.root.removeEventListener("keydown", onKeyDown, true);
      quill.root.removeEventListener("compositionend", onCompositionEnd);
      quill.off("text-change", onTextChange as never);
      quill.off("selection-change", onSelectionChange as never);
      moderator.destroy();
    },
  };
}

export type { AdapterHandle, AdapterOptions } from "../shared/moderator";
