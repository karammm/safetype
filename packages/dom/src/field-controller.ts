import type { ModerationEngine, ModerationResult, ModerationSession } from "@safetype/core";
import { getMessageLevel, MessageController } from "./messages";
import type { Surface } from "./surface";
import type { MessageLevel, MessageText, SafeTypeEventName } from "./types";

/**
 * - typing:  live pass; the word under the caret is left alone until it is finished
 *            (so "ass" is not masked while someone types "assassin")
 * - final:   blur, paste, drop, submit; everything is masked
 * - observe: undo/redo; results and messages update but text is not rewritten,
 *            so the browser's undo history keeps working. Masking resumes on the next edit or blur.
 */
export type PassKind = "typing" | "final" | "observe";

export interface FieldContext {
  engine: ModerationEngine;
  showMessages: boolean;
  messages: Partial<Record<MessageLevel, MessageText>>;
  asyncModeration: boolean;
  asyncDebounceMs: number;
  dispatch(name: SafeTypeEventName, result: ModerationResult, element: HTMLElement): void;
  reportError(error: unknown, element: HTMLElement): void;
}

const IMMEDIATE_INPUT_TYPES = new Set(["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop", "insertReplacementText", "insertFromYank"]);

function violationKey(result: ModerationResult): string {
  return result.matches
    .filter((m) => m.action !== "allow")
    .map((m) => `${m.ruleId}:${m.start}:${m.end}:${m.action}`)
    .join("|");
}

export class FieldController {
  result: ModerationResult | undefined;
  private applying = false;
  private composing = false;
  private attached = false;
  private lastViolationKey = "";
  private lastWarningKey = "";
  private readonly listeners: Array<[string, EventListener]> = [];
  private readonly messages: MessageController | null;
  private readonly session: ModerationSession | null;

  constructor(
    readonly element: HTMLElement,
    private readonly surface: Surface,
    private readonly ctx: FieldContext,
  ) {
    this.messages = ctx.showMessages ? new MessageController(element, ctx.messages) : null;
    this.session = ctx.asyncModeration ? ctx.engine.createSession({ debounceMs: ctx.asyncDebounceMs }) : null;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.listen("input", (event) => this.onInput(event as InputEvent));
    this.listen("compositionstart", () => {
      this.composing = true;
    });
    this.listen("compositionend", () => {
      this.composing = false;
      this.safeRun("typing");
    });
    this.listen("focusout", () => this.safeRun("final"));
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    for (const [type, listener] of this.listeners) this.element.removeEventListener(type, listener);
    this.listeners.length = 0;
    this.session?.cancel();
    this.messages?.clear();
  }

  private listen(type: string, listener: EventListener): void {
    this.element.addEventListener(type, listener);
    this.listeners.push([type, listener]);
  }

  private onInput(event: InputEvent): void {
    if (this.applying || this.composing || event.isComposing) return;
    const inputType = event.inputType ?? "";
    if (inputType === "historyUndo" || inputType === "historyRedo") this.safeRun("observe");
    else if (IMMEDIATE_INPUT_TYPES.has(inputType)) this.safeRun("final");
    else this.safeRun("typing");
  }

  private safeRun(kind: PassKind): void {
    try {
      this.run(kind);
    } catch (error) {
      this.ctx.reportError(error, this.element);
    }
  }

  run(kind: PassKind): ModerationResult {
    const text = this.surface.getText();
    const result = this.ctx.engine.moderate(text);
    this.applyResult(result, kind);
    if (this.session && kind !== "observe") {
      this.session.moderate(text).then(
        (asyncResult) => {
          if (asyncResult && this.attached && this.surface.getText() === asyncResult.originalText) {
            this.applyResult(asyncResult, kind === "final" ? "final" : "typing");
          }
        },
        (error: unknown) => this.ctx.reportError(error, this.element),
      );
    }
    return result;
  }

  private applyResult(result: ModerationResult, kind: PassKind): void {
    const text = result.originalText;
    let edits = kind === "observe" ? [] : result.mapping.edits.filter((e) => text.slice(e.start, e.end) !== e.replacement);
    if (kind === "typing" && edits.length) {
      const selection = this.surface.getSelection();
      if (selection && selection.start === selection.end) {
        const caret = selection.start;
        edits = edits.filter((e) => !(e.start < caret && caret <= e.end));
      }
    }
    if (edits.length) {
      this.applying = true;
      try {
        this.surface.apply(text, edits);
      } finally {
        this.applying = false;
      }
    }
    this.result = result;
    this.updateMessages(result);
    this.emit(result);
  }

  private updateMessages(result: ModerationResult): void {
    if (!this.messages) return;
    this.messages.update(getMessageLevel(result), result);
  }

  private emit(result: ModerationResult): void {
    this.ctx.dispatch("moderated", result, this.element);
    const key = violationKey(result);
    if (key !== this.lastViolationKey) {
      this.lastViolationKey = key;
      if (key) this.ctx.dispatch("violation", result, this.element);
    }
    const warningKey = result.matches.filter((m) => m.action === "warn").map((m) => `${m.ruleId}:${m.start}`).join("|");
    if (warningKey !== this.lastWarningKey) {
      this.lastWarningKey = warningKey;
      if (warningKey) this.ctx.dispatch("warning", result, this.element);
    }
  }
}
