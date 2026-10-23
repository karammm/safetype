import type { ModerationResult } from "@safetype/core";
import {
  forwardRef,
  useCallback,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useSafeType, type UseSafeTypeOptions } from "./use-safe-type";

type ModerationProps = Omit<UseSafeTypeOptions, "showMessages" | "onError"> & {
  /** Render the built-in accessible message under the field. Default true. */
  showMessage?: boolean;
  /** Skip the default inline styles on the message (style `.safetype-message` yourself). */
  unstyled?: boolean;
  /** Called with every moderation result. */
  onModeration?: (result: ModerationResult) => void;
  /** Errors from moderation callbacks or classifiers (`onError` is the element's own event). */
  onModerationError?: (error: unknown) => void;
};

export type SafeTypeInputProps = ModerationProps & Omit<InputHTMLAttributes<HTMLInputElement>, keyof ModerationProps>;
export type SafeTypeTextareaProps = ModerationProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof ModerationProps>;

const MESSAGE_STYLE: Record<"warn" | "block", CSSProperties> = {
  warn: { display: "block", marginTop: 4, fontSize: "0.875em", lineHeight: 1.4, color: "#8a5300" },
  block: { display: "block", marginTop: 4, fontSize: "0.875em", lineHeight: 1.4, color: "#b42318" },
};

let nextId = 0;

function setRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function splitProps<P extends ModerationProps>(props: P) {
  const {
    mode, language, categories, policy, packs, customWords, allowList, rules, severity, maskChar, maskStyle,
    detectSpacedLetters, classifiers, classifierTimeoutMs, engine, messages, blockSubmit, asyncModeration,
    asyncDebounceMs, onModerated, onViolation, onWarning, onBlocked, onModeration, onModerationError,
    showMessage = true, unstyled = false, ...elementProps
  } = props;
  const options: UseSafeTypeOptions = {
    mode, language, categories, policy, packs, customWords, allowList, rules, severity, maskChar, maskStyle,
    detectSpacedLetters, classifiers, classifierTimeoutMs, engine, messages, blockSubmit, asyncModeration,
    asyncDebounceMs, onViolation, onWarning, onBlocked,
    showMessages: false,
    onModerated: (result, el) => {
      onModeration?.(result);
      onModerated?.(result, el);
    },
    onError: onModerationError ? (error) => onModerationError(error) : undefined,
  };
  return { options, showMessage, unstyled, elementProps };
}

function useField<T extends HTMLInputElement | HTMLTextAreaElement>(props: ModerationProps, forwardedRef: ForwardedRef<T>, describedBy?: string) {
  const { options, showMessage, unstyled, elementProps } = splitProps(props);
  const safeType = useSafeType<T>(options);
  const [messageId] = useState(() => `safetype-message-r${++nextId}`);
  const { ref: attach } = safeType;
  const ref = useCallback(
    (node: T | null) => {
      attach(node);
      setRef(forwardedRef, node);
    },
    [attach, forwardedRef],
  );
  const message = showMessage ? safeType.message : null;
  const fieldProps = {
    ref,
    "aria-describedby": [describedBy, message ? messageId : null].filter(Boolean).join(" ") || undefined,
    "aria-invalid": safeType.message?.level === "block" ? true : undefined,
  };
  // The live region is always rendered so screen readers announce the message when it appears.
  const messageNode = showMessage ? (
    <span
      id={messageId}
      className="safetype-message"
      data-level={message?.level}
      role="status"
      aria-live="polite"
      style={unstyled || !message ? undefined : MESSAGE_STYLE[message.level]}
    >
      {message?.text}
    </span>
  ) : null;
  return { elementProps, fieldProps, messageNode };
}

/** An `<input>` with live moderation. Works controlled (`value` + `onChange`) or uncontrolled. */
export const SafeTypeInput = forwardRef<HTMLInputElement, SafeTypeInputProps>(function SafeTypeInput(props, forwardedRef) {
  const { elementProps, fieldProps, messageNode } = useField<HTMLInputElement>(props, forwardedRef, props["aria-describedby"]);
  const { "aria-invalid": ariaInvalid, ...rest } = elementProps as InputHTMLAttributes<HTMLInputElement>;
  return (
    <>
      <input {...rest} {...fieldProps} aria-invalid={fieldProps["aria-invalid"] ?? ariaInvalid} />
      {messageNode}
    </>
  );
});

/** A `<textarea>` with live moderation. Works controlled (`value` + `onChange`) or uncontrolled. */
export const SafeTypeTextarea = forwardRef<HTMLTextAreaElement, SafeTypeTextareaProps>(function SafeTypeTextarea(props, forwardedRef) {
  const { elementProps, fieldProps, messageNode } = useField<HTMLTextAreaElement>(props, forwardedRef, props["aria-describedby"]);
  const { "aria-invalid": ariaInvalid, ...rest } = elementProps as TextareaHTMLAttributes<HTMLTextAreaElement>;
  return (
    <>
      <textarea {...rest} {...fieldProps} aria-invalid={fieldProps["aria-invalid"] ?? ariaInvalid} />
      {messageNode}
    </>
  );
});
