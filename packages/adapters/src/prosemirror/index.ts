import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { ModerationResult } from "@safetype/core";
import { highlightable } from "../shared/highlights";
import { MessageRegion, resolveEngine, selectEdits, type AdapterOptions } from "../shared/moderator";

/** Plain text of a document plus a two-way offset <-> position map (blocks and hard breaks become "\n"). */
export class TextMap {
  readonly text: string;
  private readonly segments: Array<{ pos: number; start: number; end: number }> = [];

  constructor(doc: PMNode) {
    let text = "";
    doc.descendants((node, pos) => {
      if (node.isTextblock) {
        if (text.length > 0 && !text.endsWith("\n")) text += "\n";
        return true;
      }
      if (node.isText) {
        const value = node.text ?? "";
        this.segments.push({ pos, start: text.length, end: text.length + value.length });
        text += value;
        return false;
      }
      if (node.isLeaf) text += node.type.spec.leafText ? node.type.spec.leafText(node) : node.isInline ? "￼" : "\n";
      return true;
    });
    this.text = text;
  }

  charPos(offset: number): number | null {
    for (const s of this.segments) if (offset >= s.start && offset < s.end) return s.pos + offset - s.start;
    return null;
  }

  boundaryPos(offset: number, side: "start" | "end"): number | null {
    if (side === "start") return this.charPos(offset);
    for (const s of this.segments) if (offset > s.start && offset <= s.end) return s.pos + offset - s.start;
    return null;
  }

  offsetAt(pos: number): number | null {
    for (const s of this.segments) if (pos >= s.pos && pos <= s.pos + (s.end - s.start)) return s.start + pos - s.pos;
    return null;
  }
}

interface PluginState {
  result: ModerationResult;
  map: TextMap;
  decorations: DecorationSet;
}

export interface SafeTypeProseMirror {
  /** Add to `EditorState.create({ plugins: [...] })`. */
  plugin: Plugin<PluginState>;
  getResult(state: EditorState): ModerationResult | undefined;
  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(view: EditorView): { valid: boolean; result: ModerationResult } | undefined;
}

/**
 * ProseMirror plugin: inline highlights and masking through transactions. Only changed characters are
 * replaced (marks survive), the word under the cursor waits until it is finished, IME composition and
 * undo/redo are respected. (Tiptap users: `@safetype/adapters/tiptap`.)
 */
export function safeTypeProseMirror(options: AdapterOptions = {}): SafeTypeProseMirror {
  const engine = resolveEngine(options);
  const key = new PluginKey<PluginState>("safetype");
  let composing = false;
  let region: MessageRegion | null = null;
  let lastViolations = "";
  let lastWarnings = "";

  const compute = (doc: PMNode): PluginState => {
    const map = new TextMap(doc);
    const result = engine.moderate(map.text);
    const decorations = highlightable(result.matches).flatMap(({ match, level, title }) => {
      const from = map.boundaryPos(match.start, "start");
      const to = map.boundaryPos(match.end, "end");
      return from !== null && to !== null && from < to
        ? [Decoration.inline(from, to, { class: `safetype-highlight safetype-highlight-${level}`, title })]
        : [];
    });
    return { result, map, decorations: DecorationSet.create(doc, decorations) };
  };

  const maskTr = (state: EditorState, kind: "typing" | "final"): Transaction | null => {
    const current = key.getState(state);
    if (!current) return null;
    const caret = kind === "typing" && state.selection.empty ? current.map.offsetAt(state.selection.head) : null;
    const edits = selectEdits(current.result, kind, caret);
    if (!edits.length) return null;
    const tr = state.tr;
    const text = current.result.originalText;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      const before = text.slice(edit.start, edit.end);
      if (before.length === edit.replacement.length) {
        for (let i = before.length - 1; i >= 0; i--) {
          if (before[i] === edit.replacement[i]) continue;
          const pos = current.map.charPos(edit.start + i);
          if (pos !== null) tr.insertText(edit.replacement[i]!, pos, pos + 1);
        }
      } else {
        const from = current.map.boundaryPos(edit.start, "start");
        const to = current.map.boundaryPos(edit.end, "end");
        if (from !== null && to !== null) tr.insertText(edit.replacement, from, to);
      }
    }
    return tr.docChanged ? tr.setMeta(key, { masked: true }) : null;
  };

  const notify = (result: ModerationResult) => {
    region?.update(result);
    options.onModerated?.(result);
    const violations = result.matches.filter((m) => m.action !== "allow").map((m) => `${m.ruleId}:${m.start}`).join("|");
    if (violations !== lastViolations) {
      lastViolations = violations;
      if (violations) options.onViolation?.(result);
    }
    const warnings = result.matches.filter((m) => m.action === "warn").map((m) => `${m.ruleId}:${m.start}`).join("|");
    if (warnings !== lastWarnings) {
      lastWarnings = warnings;
      if (warnings) options.onWarning?.(result);
    }
  };

  const plugin = new Plugin<PluginState>({
    key,
    state: {
      init: (_, state) => compute(state.doc),
      apply: (tr, value, _old, next) => (tr.docChanged ? compute(next.doc) : value),
    },
    appendTransaction(transactions, _old, next) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (composing || transactions.some((tr) => tr.getMeta("history$") !== undefined)) return null;
      if (transactions.every((tr) => tr.getMeta(key)?.masked)) return null;
      const paste = transactions.some((tr) => tr.getMeta("uiEvent") === "paste" || tr.getMeta("uiEvent") === "drop");
      return maskTr(next, paste ? "final" : "typing");
    },
    view(view) {
      region = options.messageContainer === false ? null : new MessageRegion(options.messageContainer ?? view.dom, options.messages, view.dom);
      notify(key.getState(view.state)!.result);
      return {
        update(v, previous) {
          if (v.state.doc !== previous.doc) notify(key.getState(v.state)!.result);
        },
        destroy() {
          region?.clear();
          region = null;
        },
      };
    },
    props: {
      decorations: (state) => key.getState(state)?.decorations,
      handleDOMEvents: {
        compositionstart: () => {
          composing = true;
          return false;
        },
        compositionend: (view) => {
          composing = false;
          setTimeout(() => {
            const tr = view.isDestroyed ? null : maskTr(view.state, "typing");
            if (tr) view.dispatch(tr);
          }, 0);
          return false;
        },
        blur: (view) => {
          const tr = maskTr(view.state, "final");
          if (tr) view.dispatch(tr);
          return false;
        },
      },
    },
  });

  return {
    plugin,
    getResult: (state) => key.getState(state)?.result,
    validate(view) {
      const tr = maskTr(view.state, "final");
      if (tr) view.dispatch(tr);
      const result = key.getState(view.state)?.result;
      return result ? { valid: result.allowed, result } : undefined;
    },
  };
}

export type { AdapterOptions } from "../shared/moderator";
