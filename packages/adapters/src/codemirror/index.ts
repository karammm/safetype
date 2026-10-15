import { Annotation, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { ModerationResult } from "@safetype/core";
import { highlightable, injectHighlightStyles } from "../shared/highlights";
import { Moderator, type AdapterOptions, type EditorBinding } from "../shared/moderator";

const ours = Annotation.define<boolean>();

class SafeTypeView {
  decorations: DecorationSet = Decoration.none;
  readonly moderator: Moderator;
  private destroyed = false;

  constructor(
    private readonly view: EditorView,
    options: AdapterOptions,
  ) {
    injectHighlightStyles(view.dom.ownerDocument);
    const binding: EditorBinding = {
      getText: () => this.view.state.doc.toString(),
      getCaret: () => {
        const main = this.view.state.selection.main;
        return main.empty && this.view.hasFocus ? main.head : null;
      },
      applyEdits: (edits) => {
        // One transaction: CodeMirror maps the selection and records a single undo step.
        this.view.dispatch({
          changes: edits.map((e) => ({ from: e.start, to: e.end, insert: e.replacement })),
          annotations: ours.of(true),
        });
      },
      isComposing: () => this.view.composing,
    };
    this.moderator = new Moderator(binding, options, view.dom, view.contentDOM);
    this.decorations = this.build(view.state.doc.toString());
    queueMicrotask(() => this.runPass("observe"));
  }

  private build(text: string): DecorationSet {
    const result = this.moderator.engine.moderate(text);
    const ranges: Array<Range<Decoration>> = highlightable(result.matches).map(({ match, level, title }) =>
      Decoration.mark({ class: `safetype-highlight safetype-highlight-${level}`, attributes: { title } }).range(match.start, match.end),
    );
    return Decoration.set(ranges, true);
  }

  runPass(kind: "typing" | "final" | "observe"): ModerationResult | undefined {
    if (this.destroyed) return undefined;
    return this.moderator.run(kind);
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return;
    this.decorations = this.build(update.state.doc.toString());
    if (update.transactions.some((tr) => tr.annotation(ours))) return;
    const kind = update.transactions.some((tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo"))
      ? "observe"
      : update.transactions.some((tr) => tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop"))
        ? "final"
        : "typing";
    // Dispatching during an update is not allowed; run right after it.
    queueMicrotask(() => this.runPass(kind));
  }

  destroy(): void {
    this.destroyed = true;
    this.moderator.destroy();
  }
}

export interface SafeTypeCodeMirror {
  /** Add to the editor's `extensions`. */
  extension: Extension;
  /** Latest result for a view. */
  getResult(view: EditorView): ModerationResult | undefined;
  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(view: EditorView): { valid: boolean; result: ModerationResult } | undefined;
}

/**
 * CodeMirror 6 extension: masking through transactions (undo-friendly), inline highlights, accessible
 * messages.
 *
 * ```js
 * const safeType = safeTypeCodeMirror({ mode: "mask" });
 * new EditorView({ extensions: [basicSetup, safeType.extension], parent });
 * ```
 */
export function safeTypeCodeMirror(options: AdapterOptions = {}): SafeTypeCodeMirror {
  const plugin = ViewPlugin.define((view) => new SafeTypeView(view, options), {
    decorations: (value) => value.decorations,
    eventHandlers: {
      blur(_event, view) {
        queueMicrotask(() => view.plugin(plugin)?.runPass("final"));
      },
      compositionend(_event, view) {
        setTimeout(() => view.plugin(plugin)?.runPass("typing"), 0);
      },
    },
  });
  return {
    extension: plugin,
    getResult: (view) => view.plugin(plugin)?.moderator.result,
    validate: (view) => view.plugin(plugin)?.moderator.validate(),
  };
}

export type { AdapterOptions } from "../shared/moderator";
