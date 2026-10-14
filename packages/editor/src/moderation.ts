import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { ModerationEngine, ModerationMatch, ModerationResult } from "@safetype/core";
import { TextMap } from "./text-map";

export interface ModerationState {
  result: ModerationResult;
  map: TextMap;
  decorations: DecorationSet;
}

export const moderationKey = new PluginKey<ModerationState>("safetypeModeration");

export interface SafeTypeModerationOptions {
  engine: ModerationEngine | null;
  /** Called after every document change with the latest result. */
  onResult: (result: ModerationResult) => void;
}

const LABEL: Record<string, string> = {
  warn: "May be hurtful",
  block: "Not allowed",
  suggest: "Suggestion available",
  mask: "Masked",
  allow: "Needs review",
};

function describe(match: ModerationMatch): string {
  const base = `${LABEL[match.requiresReview ? "allow" : match.action]} (${match.category})`;
  return match.suggestedReplacement ? `${base}: try "${match.suggestedReplacement}"` : base;
}

function compute(doc: EditorState["doc"], engine: ModerationEngine): ModerationState {
  const map = new TextMap(doc);
  const result = engine.moderate(map.text);
  const decorations: Decoration[] = [];
  for (const match of result.matches) {
    if (match.applied && match.action === "mask") continue; // about to be masked
    const from = map.boundaryPos(match.start, "start");
    const to = map.boundaryPos(match.end, "end");
    if (from === null || to === null || from >= to) continue;
    const level = match.requiresReview ? "review" : match.action;
    decorations.push(
      Decoration.inline(from, to, {
        class: `safetype-highlight safetype-highlight-${level}`,
        "data-category": match.category,
        title: describe(match),
      }),
    );
  }
  return { result, map, decorations: DecorationSet.create(doc, decorations) };
}

/**
 * Builds a transaction that masks the current matches. Only characters that change are replaced, one at
 * a time, so marks (bold, links...) and structure are preserved. In `typing` mode the word under the
 * cursor is left alone until it is finished.
 */
export function maskTransaction(state: EditorState, kind: "typing" | "final"): Transaction | null {
  const moderation = moderationKey.getState(state);
  if (!moderation) return null;
  const { result, map } = moderation;
  const text = result.originalText;
  let edits = result.mapping.edits.filter((e) => text.slice(e.start, e.end) !== e.replacement);
  if (kind === "typing" && state.selection.empty) {
    const caret = map.offsetAt(state.selection.head);
    if (caret !== null) edits = edits.filter((e) => !(e.start < caret && caret <= e.end));
  }
  if (edits.length === 0) return null;

  const tr = state.tr;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    const original = text.slice(edit.start, edit.end);
    if (edit.replacement.length === original.length) {
      for (let i = original.length - 1; i >= 0; i--) {
        if (original[i] === edit.replacement[i]) continue;
        const pos = map.charPos(edit.start + i);
        if (pos !== null) tr.insertText(edit.replacement[i]!, pos, pos + 1);
      }
    } else {
      const from = map.boundaryPos(edit.start, "start");
      const to = map.boundaryPos(edit.end, "end");
      if (from !== null && to !== null) tr.insertText(edit.replacement, from, to);
    }
  }
  return tr.docChanged ? tr.setMeta(moderationKey, { masked: true }) : null;
}

function isHistory(tr: Transaction): boolean {
  return tr.getMeta("history$") !== undefined;
}

function isPasteOrDrop(tr: Transaction): boolean {
  const ui = tr.getMeta("uiEvent");
  return ui === "paste" || ui === "drop" || tr.getMeta("paste") === true;
}

/** Tiptap extension: inline highlights + transaction-based masking. */
export const SafeTypeModeration = Extension.create<SafeTypeModerationOptions>({
  name: "safeTypeModeration",

  addOptions() {
    return { engine: null, onResult: () => undefined };
  },

  addProseMirrorPlugins() {
    const { engine, onResult } = this.options;
    if (!engine) throw new Error("SafeTypeModeration requires an engine");
    const editor = this.editor;
    let composing = false;

    const finalPass = (view: EditorView) => {
      const tr = maskTransaction(view.state, "final");
      if (tr) view.dispatch(tr);
    };

    return [
      new Plugin<ModerationState>({
        key: moderationKey,
        state: {
          init: (_, state) => compute(state.doc, engine),
          apply: (tr, value, _old, newState) => (tr.docChanged || tr.getMeta(moderationKey)?.refresh ? compute(newState.doc, engine) : value),
        },
        appendTransaction(transactions, _old, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          // Never rewrite while an IME is composing, or right after undo/redo (the user asked for that text).
          if (composing || editor.view?.composing || transactions.some(isHistory)) return null;
          if (transactions.every((tr) => tr.getMeta(moderationKey)?.masked)) return null;
          return maskTransaction(newState, transactions.some(isPasteOrDrop) ? "final" : "typing");
        },
        view: () => ({
          update: (view, previous) => {
            if (view.state.doc !== previous.doc || moderationKey.getState(view.state) !== moderationKey.getState(previous)) {
              const state = moderationKey.getState(view.state);
              if (state) onResult(state.result);
            }
          },
        }),
        props: {
          decorations: (state) => moderationKey.getState(state)?.decorations,
          handleDOMEvents: {
            compositionstart: () => {
              composing = true;
              return false;
            },
            compositionend: (view) => {
              composing = false;
              // ProseMirror applies the composed text after this event.
              setTimeout(() => {
                if (view.isDestroyed) return;
                const tr = maskTransaction(view.state, "typing");
                if (tr) view.dispatch(tr);
              }, 0);
              return false;
            },
            blur: (view) => {
              finalPass(view);
              return false;
            },
          },
        },
      }),
    ];
  },
});
