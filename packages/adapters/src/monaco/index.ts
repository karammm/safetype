import { highlightable, injectHighlightStyles } from "../shared/highlights";
import { Moderator, type AdapterHandle, type AdapterOptions, type EditorBinding } from "../shared/moderator";

interface Position {
  lineNumber: number;
  column: number;
}
interface Disposable {
  dispose(): void;
}

/** The parts of a Monaco editor the adapter uses (structural, so monaco-editor is not imported). */
export interface MonacoEditorLike {
  getModel(): {
    getValue(): string;
    getPositionAt(offset: number): Position;
    getOffsetAt(position: Position): number;
  } | null;
  getSelection(): { isEmpty(): boolean; getPosition(): Position } | null;
  hasTextFocus(): boolean;
  executeEdits(
    source: string,
    edits: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }>,
  ): boolean;
  createDecorationsCollection(decorations?: unknown[]): { set(decorations: unknown[]): void; clear(): void };
  onDidChangeModelContent(listener: (event: { isUndoing: boolean; isRedoing: boolean; changes: Array<{ text: string }> }) => void): Disposable;
  onDidBlurEditorText(listener: () => void): Disposable;
  onDidCompositionStart?(listener: () => void): Disposable;
  onDidCompositionEnd?(listener: () => void): Disposable;
  getContainerDomNode(): HTMLElement;
}

/**
 * Moderates a Monaco editor: masking via `executeEdits` (undoable), inline highlights with hover
 * explanations, accessible messages.
 *
 * ```js
 * const editor = monaco.editor.create(el, { value: "", language: "markdown" });
 * const safeType = safeTypeMonaco(editor, { mode: "mask" });
 * ```
 */
export function safeTypeMonaco(editor: MonacoEditorLike, options: AdapterOptions = {}): AdapterHandle {
  let composing = false;
  const decorations = editor.createDecorationsCollection([]);
  injectHighlightStyles(editor.getContainerDomNode().ownerDocument);

  const binding: EditorBinding = {
    getText: () => editor.getModel()?.getValue() ?? "",
    getCaret() {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection || !selection.isEmpty() || !editor.hasTextFocus()) return null;
      return model.getOffsetAt(selection.getPosition());
    },
    applyEdits(edits) {
      const model = editor.getModel();
      if (!model) return;
      editor.executeEdits(
        "safetype",
        edits.map((e) => {
          const start = model.getPositionAt(e.start);
          const end = model.getPositionAt(e.end);
          return {
            range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
            text: e.replacement,
          };
        }),
      );
    },
    isComposing: () => composing,
  };

  const moderator = new Moderator(binding, {
    ...options,
    onModerated: (result) => {
      const model = editor.getModel();
      if (model) {
        decorations.set(
          highlightable(result.matches).map(({ match, level, title }) => {
            const start = model.getPositionAt(match.start);
            const end = model.getPositionAt(match.end);
            return {
              range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
              options: { inlineClassName: `safetype-highlight safetype-highlight-${level}`, hoverMessage: { value: title } },
            };
          }),
        );
      }
      options.onModerated?.(result);
    },
  }, editor.getContainerDomNode(), null);

  const disposables: Disposable[] = [
    editor.onDidChangeModelContent((event) => {
      if (moderator.busy) return;
      const inserted = event.changes.reduce((n, c) => n + c.text.length, 0);
      moderator.run(event.isUndoing || event.isRedoing ? "observe" : inserted > 1 ? "final" : "typing");
    }),
    editor.onDidBlurEditorText(() => moderator.run("final")),
  ];
  if (editor.onDidCompositionStart) disposables.push(editor.onDidCompositionStart(() => (composing = true)));
  if (editor.onDidCompositionEnd) {
    disposables.push(
      editor.onDidCompositionEnd(() => {
        composing = false;
        moderator.run("typing");
      }),
    );
  }
  moderator.run("observe");

  return {
    engine: moderator.engine,
    getResult: () => moderator.result,
    validate: () => moderator.validate(),
    destroy() {
      for (const d of disposables) d.dispose();
      decorations.clear();
      moderator.destroy();
    },
  };
}

export type { AdapterHandle, AdapterOptions } from "../shared/moderator";
