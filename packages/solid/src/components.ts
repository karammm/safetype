import { ENGINE_CONFIG_KEYS, type ModerationResult } from "@safetype/core";
import type { MessageLevel } from "@safetype/dom";
import { createComponent, createSignal, type Component, createUniqueId, mergeProps, splitProps, untrack, type Accessor, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { EngineOptions } from "./engine";
import { useSafeType, type DomOptions, type SafeTypeMessage } from "./primitives";

const MESSAGE_STYLE: Record<MessageLevel, JSX.CSSProperties> = {
  warn: { display: "block", "margin-top": "4px", "font-size": "0.875em", "line-height": "1.4", color: "#8a5300" },
  block: { display: "block", "margin-top": "4px", "font-size": "0.875em", "line-height": "1.4", color: "#b42318" },
};

/** What `apiRef` receives. */
export interface SafeTypeFieldApi {
  element: Accessor<HTMLInputElement | HTMLTextAreaElement | undefined>;
  result: Accessor<ModerationResult | undefined>;
  message: Accessor<SafeTypeMessage | null>;
  validate: () => { valid: boolean; result: ModerationResult | undefined };
  focus: () => void;
}

interface SafeTypeFieldProps extends EngineOptions, Pick<DomOptions, "messages" | "blockSubmit" | "asyncModeration" | "asyncDebounceMs"> {
  /** Controlled value. SafeType's masked text comes back through `onValueChange`. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Render the built-in accessible message under the field (default `true`). */
  showMessage?: boolean;
  /** Skip the default inline message styles (style `.safetype-message` yourself). */
  unstyled?: boolean;
  onModeration?: (result: ModerationResult) => void;
  onViolation?: (result: ModerationResult) => void;
  onWarning?: (result: ModerationResult) => void;
  onBlocked?: (result: ModerationResult) => void;
  onModerationError?: (error: unknown) => void;
  /** Receives `validate()`, `result()`, `message()` and `focus()`. */
  apiRef?: (api: SafeTypeFieldApi) => void;
}

export type SafeTypeInputProps = SafeTypeFieldProps & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value">;
export type SafeTypeTextareaProps = SafeTypeFieldProps & Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "value">;

const LOCAL = [
  "value", "onValueChange", "showMessage", "unstyled", "messages", "blockSubmit", "asyncModeration", "asyncDebounceMs",
  "onModeration", "onViolation", "onWarning", "onBlocked", "onModerationError", "apiRef", "ref", "onInput",
] as const;
const ENGINE = [...ENGINE_CONFIG_KEYS, "engine"] as const;

type Handler = ((event: Event) => void) | [(data: unknown, event: Event) => void, unknown];

function callHandler(handler: Handler | undefined, event: Event): void {
  if (typeof handler === "function") handler(event);
  else if (Array.isArray(handler)) handler[0](handler[1], event);
}

function createField(tag: "input" | "textarea", props: SafeTypeFieldProps & Record<string, unknown>): JSX.Element {
  const merged = mergeProps({ showMessage: true }, props);
  const [local, engineProps, rest] = splitProps(merged, LOCAL, ENGINE as unknown as (keyof typeof merged)[]);
  const others = rest as Record<string, unknown>;
  const [element, setElement] = createSignal<HTMLInputElement | HTMLTextAreaElement>();
  const safeType = useSafeType(element, () => ({
    ...(engineProps as EngineOptions),
    messages: local.messages,
    blockSubmit: local.blockSubmit,
    asyncModeration: local.asyncModeration,
    asyncDebounceMs: local.asyncDebounceMs,
    showMessages: false,
    onModerated: (result) => local.onModeration?.(result),
    onViolation: (result) => local.onViolation?.(result),
    onWarning: (result) => local.onWarning?.(result),
    onBlocked: (result) => local.onBlocked?.(result),
    onError: (error) => {
      if (local.onModerationError) local.onModerationError(error);
      else console.error("[safetype]", error);
    },
  }));
  const messageId = `safetype-message-${createUniqueId()}`;
  const shown = () => (local.showMessage ? safeType.message() : null);

  local.apiRef?.({
    element,
    result: safeType.result,
    message: safeType.message,
    validate: safeType.validate,
    focus: () => element()?.focus(),
  });

  const field = createComponent(
    Dynamic as Component<Record<string, unknown>>,
    mergeProps(others, {
      component: tag,
      ref: (el: HTMLInputElement | HTMLTextAreaElement) => {
        setElement(el);
        const userRef = local.ref as unknown;
        if (typeof userRef === "function") (userRef as (el: HTMLElement) => void)(el);
      },
      // Only bind `value` when controlled: an undefined value would become the text "undefined".
      ...(untrack(() => local.value) !== undefined
        ? {
            get value() {
              return local.value ?? "";
            },
          }
        : {}),
      get "aria-describedby"() {
        return [others["aria-describedby"], shown() ? messageId : null].filter(Boolean).join(" ") || undefined;
      },
      get "aria-invalid"() {
        return safeType.message()?.level === "block" ? "true" : others["aria-invalid"];
      },
      onInput: (event: Event) => {
        local.onValueChange?.((event.target as HTMLInputElement).value);
        callHandler(local.onInput as Handler | undefined, event);
      },
    }),
  );

  // The live region is always rendered so screen readers announce the message when it appears.
  const live = createComponent(Dynamic, {
    component: "span",
    id: messageId,
    class: "safetype-message",
    role: "status",
    "aria-live": "polite",
    get "data-level"() {
      return shown()?.level;
    },
    get style() {
      const message = shown();
      return local.unstyled || !message ? undefined : MESSAGE_STYLE[message.level];
    },
    get children() {
      return shown()?.text ?? "";
    },
  });

  return (() => (local.showMessage ? [field, live] : field)) as unknown as JSX.Element;
}

/**
 * `<input>` with live moderation. Other props pass through to the element.
 *
 * ```tsx
 * <SafeTypeInput value={text()} onValueChange={setText} mode="mask" />
 * ```
 */
export function SafeTypeInput(props: SafeTypeInputProps): JSX.Element {
  return createField("input", props as SafeTypeFieldProps & Record<string, unknown>);
}

/** `<textarea>` with live moderation. Other props pass through to the element. */
export function SafeTypeTextarea(props: SafeTypeTextareaProps): JSX.Element {
  return createField("textarea", props as SafeTypeFieldProps & Record<string, unknown>);
}
