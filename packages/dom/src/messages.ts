import type { ModerationResult } from "@safetype/core";
import type { MessageLevel, MessageText } from "./types";

export const DEFAULT_MESSAGES: Record<MessageLevel, string> = {
  warn: "This may come across as hurtful. Please consider rephrasing.",
  block: "This can't be sent because it contains language that breaks the community guidelines.",
};

export const STYLES = `
:where(.safetype-message){display:block;margin-top:4px;font-size:.875em;line-height:1.4}
:where(.safetype-message[data-level="warn"]){color:#8a5300}
:where(.safetype-message[data-level="block"]){color:#b42318}
`;

/** The message level a result calls for: `block`, `warn`, or null. */
export function getMessageLevel(result: ModerationResult): MessageLevel | null {
  if (result.action === "block") return "block";
  return result.matches.some((m) => m.action === "warn") ? "warn" : null;
}

export function resolveMessage(
  level: MessageLevel,
  texts: Partial<Record<MessageLevel, MessageText>> | undefined,
  result: ModerationResult,
): string {
  const configured = texts?.[level] ?? DEFAULT_MESSAGES[level];
  return typeof configured === "function" ? configured(result) : configured;
}

let nextId = 0;

function addToken(el: Element, attr: string, token: string): void {
  const tokens = (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean);
  if (!tokens.includes(token)) el.setAttribute(attr, [...tokens, token].join(" "));
}

function removeToken(el: Element, attr: string, token: string): void {
  const tokens = (el.getAttribute(attr) ?? "").split(/\s+/).filter((t) => t && t !== token);
  if (tokens.length) el.setAttribute(attr, tokens.join(" "));
  else el.removeAttribute(attr);
}

/** One polite live region per field, linked with aria-describedby. */
export class MessageController {
  private node: HTMLElement | null = null;
  private readonly id = `safetype-message-${++nextId}`;
  private setInvalid = false;

  constructor(
    private readonly field: HTMLElement,
    private readonly texts: Partial<Record<MessageLevel, MessageText>>,
  ) {}

  update(level: MessageLevel | null, result: ModerationResult): void {
    if (!level) return this.clear();
    const text = resolveMessage(level, this.texts, result);
    if (!this.node) {
      const node = this.field.ownerDocument.createElement("div");
      node.id = this.id;
      node.className = "safetype-message";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      this.field.insertAdjacentElement("afterend", node);
      addToken(this.field, "aria-describedby", this.id);
      this.node = node;
    }
    this.node.dataset.level = level;
    if (this.node.textContent !== text) this.node.textContent = text;
    if (level === "block") {
      if (!this.field.hasAttribute("aria-invalid")) {
        this.field.setAttribute("aria-invalid", "true");
        this.setInvalid = true;
      }
    } else {
      this.clearInvalid();
    }
  }

  private clearInvalid(): void {
    if (this.setInvalid) this.field.removeAttribute("aria-invalid");
    this.setInvalid = false;
  }

  clear(): void {
    this.clearInvalid();
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    removeToken(this.field, "aria-describedby", this.id);
  }
}
