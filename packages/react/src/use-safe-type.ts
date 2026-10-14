import type { ModerationEngine, ModerationResult } from "@safetype/core";
import {
  createSafeType,
  getMessageLevel,
  resolveMessage,
  type MessageLevel,
  type MessageText,
  type SafeTypeInstance,
  type SafeTypeOptions,
} from "@safetype/dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEngine, type EngineOptions } from "./engine";

type DomOptions = Pick<
  SafeTypeOptions,
  "showMessages" | "messages" | "blockSubmit" | "asyncModeration" | "asyncDebounceMs" | "onModerated" | "onViolation" | "onWarning" | "onBlocked" | "onError"
>;

export interface UseSafeTypeOptions extends EngineOptions, DomOptions {}

export interface SafeTypeMessage {
  level: MessageLevel;
  text: string;
}

export interface UseSafeTypeReturn<T extends HTMLElement> {
  /** Attach to an `<input>`, `<textarea>` or contenteditable element. */
  ref: (node: T | null) => void;
  /** Latest moderation result for the element. */
  result: ModerationResult | undefined;
  /** Message to show for the latest result (warn/block), or null. */
  message: SafeTypeMessage | null;
  /** Runs a final pass (masks pending words) and reports whether the content may be submitted. */
  validate: () => { valid: boolean; result: ModerationResult | undefined };
  engine: ModerationEngine;
}

/**
 * Moderates one element with `@safetype/dom`. Messages are not rendered by default
 * (`showMessages: false`); render `message` yourself, or use `<SafeTypeInput>`.
 */
export function useSafeType<T extends HTMLElement = HTMLElement>(options: UseSafeTypeOptions = {}): UseSafeTypeReturn<T> {
  const engine = useEngine(options);
  const latest = useRef(options);
  latest.current = options;

  const [element, setElement] = useState<T | null>(null);
  const [result, setResult] = useState<ModerationResult>();
  const instance = useRef<SafeTypeInstance | null>(null);

  // Read message texts lazily so inline objects/functions don't recreate the instance.
  const messages = useMemo<Partial<Record<MessageLevel, MessageText>>>(
    () => ({
      get warn() {
        return latest.current.messages?.warn;
      },
      get block() {
        return latest.current.messages?.block;
      },
    }),
    [],
  );

  const { showMessages = false, blockSubmit, asyncModeration, asyncDebounceMs } = options;

  useEffect(() => {
    if (!element) return;
    // State updates and user callbacks run after the browser event has finished dispatching.
    // SafeType's listener fires before React's root listener; a synchronous setState there makes
    // React re-render a controlled input with stale state between the two listeners, which wipes
    // the keystroke before onChange sees it. Masking itself still happens synchronously.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, 0);
      timers.add(timer);
    };
    const st = createSafeType({
      engine,
      root: element,
      observeDynamicElements: false,
      showMessages,
      messages,
      blockSubmit,
      asyncModeration: asyncModeration ?? (latest.current.classifiers?.length ?? 0) > 0,
      asyncDebounceMs,
      onModerated: (r, el) =>
        later(() => {
          setResult(r);
          latest.current.onModerated?.(r, el);
        }),
      onViolation: (r, el) => later(() => latest.current.onViolation?.(r, el)),
      onWarning: (r, el) => later(() => latest.current.onWarning?.(r, el)),
      onBlocked: (r, el) => later(() => latest.current.onBlocked?.(r, el)),
      onError: (error, el) =>
        later(() => {
          if (latest.current.onError) latest.current.onError(error, el);
          else console.error("[safetype]", error);
        }),
    });
    st.start();
    instance.current = st;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      st.destroy();
      if (instance.current === st) instance.current = null;
    };
  }, [element, engine, messages, showMessages, blockSubmit, asyncModeration, asyncDebounceMs]);

  const ref = useCallback((node: T | null) => setElement(node), []);

  const validate = useCallback(() => {
    const outcome = instance.current?.validate();
    const first = outcome?.results[0]?.result;
    if (first) setResult(first);
    return { valid: outcome?.valid ?? true, result: first };
  }, []);

  const level = result ? getMessageLevel(result) : null;
  const message = level && result ? { level, text: resolveMessage(level, latest.current.messages, result) } : null;

  return { ref, result, message, validate, engine };
}
