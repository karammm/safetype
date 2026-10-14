/**
 * Decides which elements SafeType may touch. Errs on the side of *not* moderating:
 * anything that looks like a credential, payment, contact or verification field is skipped.
 */

export const DEFAULT_SELECTOR = "input, textarea, [contenteditable]";

const TEXT_INPUT_TYPES = new Set(["text", "search"]);

const SENSITIVE_AUTOCOMPLETE = new Set([
  "current-password", "new-password", "one-time-code", "email", "username", "tel",
  "cc-name", "cc-given-name", "cc-family-name", "cc-number", "cc-exp", "cc-exp-month",
  "cc-exp-year", "cc-csc", "cc-type",
]);

const SENSITIVE_NAME = /pass(word|wd)?|pwd|secret|token|otp|one.?time|cvv|cvc|card.?num|cc.?num|iban|ssn|social.?sec|pin(code)?$/i;

/** Editors that own their DOM and must be integrated through adapters, never mutated directly. */
export const MANAGED_EDITOR_SELECTOR = [
  ".ProseMirror",
  "[data-lexical-editor]",
  ".ql-editor",
  ".cm-content",
  ".monaco-editor",
  "[data-slate-editor]",
  ".public-DraftEditor-content",
  ".ck-editor__editable",
].join(", ");

export function isTextControl(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

function isEditable(el: Element): boolean {
  const html = el as HTMLElement;
  if (typeof html.isContentEditable === "boolean") {
    return html.isContentEditable;
  }
  // Fallback for environments without layout-aware isContentEditable (e.g. jsdom).
  for (let node: Element | null = el; node; node = node.parentElement) {
    const value = node.getAttribute("contenteditable");
    if (value === null) continue;
    return value === "" || value === "true" || value === "plaintext-only";
  }
  return false;
}

/** The outermost editable element (the one that receives focus and input events). */
export function isEditingHost(el: Element): boolean {
  if (isTextControl(el) || !isEditable(el)) return false;
  return !el.parentElement || !isEditable(el.parentElement);
}

function looksSensitive(el: Element): boolean {
  const autocomplete = (el.getAttribute("autocomplete") ?? "").toLowerCase().split(/\s+/);
  if (autocomplete.some((token) => SENSITIVE_AUTOCOMPLETE.has(token))) return true;
  const hints = [el.getAttribute("name"), el.id, el.getAttribute("inputmode") === "numeric" ? "pin" : null];
  return hints.some((hint) => hint !== null && hint !== "" && SENSITIVE_NAME.test(hint));
}

export function isEligible(el: Element, excludeSelectors: readonly string[]): boolean {
  if (el.nodeType !== 1) return false;
  if (el.closest('[data-safetype="off"]')) return false;
  for (const selector of excludeSelectors) if (el.matches(selector)) return false;

  if (el.tagName === "INPUT") {
    const input = el as HTMLInputElement;
    const type = (input.getAttribute("type") ?? "text").toLowerCase();
    if (!TEXT_INPUT_TYPES.has(type)) return false;
    if (input.readOnly || input.disabled) return false;
    return !looksSensitive(el);
  }
  if (el.tagName === "TEXTAREA") {
    const textarea = el as HTMLTextAreaElement;
    if (textarea.readOnly || textarea.disabled) return false;
    return !looksSensitive(el);
  }
  if (!isEditingHost(el)) return false;
  if (el.matches(MANAGED_EDITOR_SELECTOR) || el.closest(MANAGED_EDITOR_SELECTOR)) return false;
  return !looksSensitive(el);
}
