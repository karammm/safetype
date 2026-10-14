import type { EngineConfig, ModerationEngine, ModerationResult } from "@safetype/core";

export type SafeTypeEventName = "moderated" | "violation" | "warning" | "blocked";

export interface SafeTypeEventDetail {
  result: ModerationResult;
  element: HTMLElement;
}

export type MessageLevel = "warn" | "block";

export type MessageText = string | ((result: ModerationResult) => string);

export interface SafeTypeOptions
  extends Omit<EngineConfig, "onModerated" | "onViolation" | "onBlocked" | "onWarning" | "onError"> {
  /** Which elements to consider. Sensitive fields are always excluded. */
  selector?: string;
  /** Where to look for fields. Defaults to `document`. Pass an open ShadowRoot to moderate inside it. */
  root?: Document | Element | ShadowRoot;
  /** Reuse an existing engine instead of creating one from the engine options. */
  engine?: ModerationEngine;
  /** Attach to fields added after `start()` (MutationObserver). Default true. */
  observeDynamicElements?: boolean;
  /** Extra selectors to never moderate, in addition to the built-in sensitive-field rules. */
  excludeSelectors?: string[];
  /** Render accessible warning messages after fields. Default true. */
  showMessages?: boolean;
  messages?: Partial<Record<MessageLevel, MessageText>>;
  /** Inject the small default stylesheet for messages. Default true. */
  injectStyles?: boolean;
  /** Prevent form submission when a field's content is blocked. Default true. */
  blockSubmit?: boolean;
  /** Run `moderateAsync` (contextual classifiers) after typing pauses. Defaults to true when `classifiers` are set. */
  asyncModeration?: boolean;
  asyncDebounceMs?: number;
  onModerated?: (result: ModerationResult, element: HTMLElement) => void;
  /** Fires when the set of violations in a field changes (not on every keystroke). */
  onViolation?: (result: ModerationResult, element: HTMLElement) => void;
  onWarning?: (result: ModerationResult, element: HTMLElement) => void;
  /** Fires when a form submission is prevented because a field is blocked. */
  onBlocked?: (result: ModerationResult, element: HTMLElement) => void;
  onError?: (error: unknown, element?: HTMLElement) => void;
}

export interface FieldResult {
  element: HTMLElement;
  result: ModerationResult;
}

export interface SafeTypeInstance {
  readonly engine: ModerationEngine;
  readonly running: boolean;
  /** Currently attached elements. */
  readonly elements: HTMLElement[];
  start(): void;
  /** Detaches from every field and stops observing. `start()` can be called again. */
  stop(): void;
  /** `stop()` and make the instance unusable. */
  destroy(): void;
  /** Attach to a specific element (still subject to sensitive-field exclusion). */
  attach(element: Element): boolean;
  detach(element: Element): void;
  /** Latest result for an attached field. */
  getResult(element: Element): ModerationResult | undefined;
  /** Final moderation pass over every attached field (masks pending words, updates messages). */
  validate(): { valid: boolean; results: FieldResult[] };
}

declare global {
  interface HTMLElementEventMap {
    "safetype:moderated": CustomEvent<SafeTypeEventDetail>;
    "safetype:violation": CustomEvent<SafeTypeEventDetail>;
    "safetype:warning": CustomEvent<SafeTypeEventDetail>;
    "safetype:blocked": CustomEvent<SafeTypeEventDetail>;
  }
}
