import {
  createModerationEngine,
  pickEngineConfig,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationEngine,
  type ModerationMatch,
  type ModerationResult,
  type TextEdit,
} from "@safetype/core";
import { getMessageLevel, resolveMessage, type MessageLevel, type MessageText } from "@safetype/dom";

/**
 * The adapter contract. An editor integration only has to say how to read its plain text, where the
 * cursor is, and how to apply edits through the editor's own API; the moderator does everything else.
 * Offsets are UTF-16 code units in `getText()`'s string.
 */
export interface EditorBinding {
  /** Plain text of the document. Block boundaries should be "\n" so words never join across them. */
  getText(): string;
  /** Collapsed cursor offset in `getText()` coordinates, or null when unknown / not focused. */
  getCaret(): number | null;
  /** Applies same-offset edits computed against `original`, via the editor's transaction API. */
  applyEdits(edits: readonly TextEdit[], original: string): void;
  /** True while an IME composition is in progress. */
  isComposing?(): boolean;
}

/** Options shared by every adapter. */
export interface AdapterOptions extends Pick<EngineConfig, EngineConfigKey> {
  engine?: ModerationEngine;
  messages?: Partial<Record<MessageLevel, MessageText>>;
  /**
   * Where to render the accessible warning/block message. Default: right after the editor's container.
   * `false` disables it (use the callbacks to render your own).
   */
  messageContainer?: HTMLElement | false;
  onModerated?: (result: ModerationResult) => void;
  /** Fires when the set of violations changes (not on every keystroke). */
  onViolation?: (result: ModerationResult) => void;
  onWarning?: (result: ModerationResult) => void;
  onError?: (error: unknown) => void;
}

/** What every adapter returns. */
export interface AdapterHandle {
  readonly engine: ModerationEngine;
  /** Latest moderation result. */
  getResult(): ModerationResult | undefined;
  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(): { valid: boolean; result: ModerationResult };
  /** Stops moderating and removes listeners, highlights and messages. */
  destroy(): void;
}

export type PassKind = "typing" | "final" | "observe";

export function resolveEngine(options: AdapterOptions): ModerationEngine {
  return options.engine ?? createModerationEngine(pickEngineConfig(options));
}

/** Drops edits that change nothing and, while typing, the word the cursor is still in. */
export function selectEdits(result: ModerationResult, kind: PassKind, caret: number | null): TextEdit[] {
  if (kind === "observe") return [];
  const text = result.originalText;
  let edits = result.mapping.edits.filter((e) => text.slice(e.start, e.end) !== e.replacement);
  if (kind === "typing" && caret !== null) edits = edits.filter((e) => !(e.start < caret && caret <= e.end));
  return edits;
}

function key(result: ModerationResult, filter: (m: ModerationMatch) => boolean): string {
  return result.matches.filter(filter).map((m) => `${m.ruleId}:${m.start}:${m.end}:${m.action}`).join("|");
}

let nextId = 0;

/** Accessible live region for warn/block messages (shared by adapters). */
export class MessageRegion {
  private node: HTMLElement | null = null;
  private readonly id = `safetype-adapter-message-${++nextId}`;

  constructor(
    private readonly anchor: HTMLElement | null,
    private readonly texts: Partial<Record<MessageLevel, MessageText>> | undefined,
    private readonly describes: HTMLElement | null,
  ) {}

  update(result: ModerationResult): void {
    if (!this.anchor) return;
    const level = getMessageLevel(result);
    if (!level) return this.clear();
    if (!this.node) {
      const node = this.anchor.ownerDocument.createElement("div");
      node.id = this.id;
      node.className = "safetype-message";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.style.cssText = "display:block;margin-top:4px;font-size:.875em;line-height:1.4";
      this.anchor.insertAdjacentElement("afterend", node);
      this.describes?.setAttribute("aria-describedby", [this.describes.getAttribute("aria-describedby"), this.id].filter(Boolean).join(" "));
      this.node = node;
    }
    this.node.dataset.level = level;
    this.node.style.color = level === "block" ? "#b42318" : "#8a5300";
    const text = resolveMessage(level, this.texts, result);
    if (this.node.textContent !== text) this.node.textContent = text;
  }

  clear(): void {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    if (this.describes) {
      const rest = (this.describes.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((t) => t && t !== this.id);
      if (rest.length) this.describes.setAttribute("aria-describedby", rest.join(" "));
      else this.describes.removeAttribute("aria-describedby");
    }
  }
}

/**
 * Generic controller used by the Quill, Lexical and Monaco adapters (and available for custom editors):
 * call `run("typing")` after user edits, `run("final")` on blur/paste, `run("observe")` after undo/redo.
 */
export class Moderator {
  readonly engine: ModerationEngine;
  result: ModerationResult | undefined;
  private applying = false;
  private lastViolations = "";
  private lastWarnings = "";
  private readonly region: MessageRegion;

  constructor(
    private readonly binding: EditorBinding,
    private readonly options: AdapterOptions,
    messageAnchor: HTMLElement | null,
    describes: HTMLElement | null,
  ) {
    this.engine = resolveEngine(options);
    const anchor = options.messageContainer === false ? null : (options.messageContainer ?? messageAnchor);
    this.region = new MessageRegion(anchor, options.messages, describes);
  }

  /** True while the moderator is applying its own edits (adapters ignore those change events). */
  get busy(): boolean {
    return this.applying;
  }

  run(kind: PassKind): ModerationResult | undefined {
    if (this.applying) return this.result;
    if (kind !== "final" && this.binding.isComposing?.()) return this.result;
    try {
      const text = this.binding.getText();
      const result = this.engine.moderate(text);
      const edits = selectEdits(result, kind, kind === "typing" ? this.binding.getCaret() : null);
      if (edits.length) {
        this.applying = true;
        try {
          this.binding.applyEdits(edits, text);
        } finally {
          this.applying = false;
        }
      }
      this.publish(result);
      return result;
    } catch (error) {
      this.report(error);
      return this.result;
    }
  }

  publish(result: ModerationResult): void {
    this.result = result;
    this.region.update(result);
    const { onModerated, onViolation, onWarning } = this.options;
    this.safe(() => onModerated?.(result));
    const violations = key(result, (m) => m.action !== "allow");
    if (violations !== this.lastViolations) {
      this.lastViolations = violations;
      if (violations) this.safe(() => onViolation?.(result));
    }
    const warnings = key(result, (m) => m.action === "warn");
    if (warnings !== this.lastWarnings) {
      this.lastWarnings = warnings;
      if (warnings) this.safe(() => onWarning?.(result));
    }
  }

  validate(): { valid: boolean; result: ModerationResult } {
    const result = this.run("final") ?? this.engine.moderate(this.binding.getText());
    return { valid: result.allowed, result };
  }

  destroy(): void {
    this.region.clear();
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.report(error);
    }
  }

  private report(error: unknown): void {
    if (this.options.onError) this.options.onError(error);
    else console.error("[safetype]", error);
  }
}

/** Splits an edit into single-character replacements (keeps formatting) when lengths match. */
export function characterEdits(edits: readonly TextEdit[], original: string): Array<{ offset: number; char: string } | TextEdit> {
  const out: Array<{ offset: number; char: string } | TextEdit> = [];
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    const before = original.slice(edit.start, edit.end);
    if (before.length !== edit.replacement.length) {
      out.push(edit);
      continue;
    }
    for (let i = before.length - 1; i >= 0; i--) {
      if (before[i] !== edit.replacement[i]) out.push({ offset: edit.start + i, char: edit.replacement[i]! });
    }
  }
  return out;
}
