import type { ModerationEngine, ModerationResult } from "@safetype/core";
import {
  createSafeType as createDomSafeType,
  getMessageLevel,
  resolveMessage,
  type MessageLevel,
  type SafeTypeInstance,
  type SafeTypeOptions,
} from "@safetype/dom";
import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js";
import { access, useEngine, type EngineOptions, type MaybeAccessor } from "./engine";

export type DomOptions = Pick<
  SafeTypeOptions,
  "showMessages" | "messages" | "blockSubmit" | "asyncModeration" | "asyncDebounceMs" | "onModerated" | "onViolation" | "onWarning" | "onBlocked" | "onError"
>;

export interface UseSafeTypeOptions extends EngineOptions, DomOptions {}

export interface SafeTypeMessage {
  level: MessageLevel;
  text: string;
}

export interface UseSafeTypeReturn {
  result: Accessor<ModerationResult | undefined>;
  message: Accessor<SafeTypeMessage | null>;
  /** Final pass (masks pending words); `valid` is false when the content is blocked. */
  validate: () => { valid: boolean; result: ModerationResult | undefined };
  engine: ModerationEngine;
}

/**
 * Reactive moderation of a string (previews, chat bubbles, pre-send checks). No DOM involved.
 *
 * ```ts
 * const result = useModeration(text);
 * <p>{result().text}</p>
 * ```
 */
export function useModeration(text: MaybeAccessor<string>, options: MaybeAccessor<EngineOptions> = {}): Accessor<ModerationResult> {
  const engine = useEngine(options);
  return createMemo(() => {
    // Track mode/policy so a live change re-moderates.
    void access(options).mode;
    void JSON.stringify(access(options).policy ?? null);
    return engine.moderate(access(text));
  });
}

/** Creates the DOM controller for one element, forwarding events to the latest options. */
export function attach(element: HTMLElement, engine: ModerationEngine, opts: () => UseSafeTypeOptions, showMessages: boolean, onResult?: (r: ModerationResult) => void): SafeTypeInstance {
  const initial = untrack(opts);
  const instance = createDomSafeType({
    engine,
    root: element,
    observeDynamicElements: false,
    showMessages: initial.showMessages ?? showMessages,
    messages: {
      get warn() {
        return untrack(opts).messages?.warn;
      },
      get block() {
        return untrack(opts).messages?.block;
      },
    },
    blockSubmit: initial.blockSubmit,
    asyncModeration: initial.asyncModeration ?? (initial.classifiers?.length ?? 0) > 0,
    asyncDebounceMs: initial.asyncDebounceMs,
    onModerated: (r, el) => {
      onResult?.(r);
      untrack(opts).onModerated?.(r, el);
    },
    onViolation: (r, el) => untrack(opts).onViolation?.(r, el),
    onWarning: (r, el) => untrack(opts).onWarning?.(r, el),
    onBlocked: (r, el) => untrack(opts).onBlocked?.(r, el),
    onError: (error, el) => {
      const handler = untrack(opts).onError;
      if (handler) handler(error, el);
      else console.error("[safetype]", error);
    },
  });
  instance.start();
  return instance;
}

/**
 * Moderates an element as the user types. Messages are not rendered by default
 * (`showMessages: false`): render `message()` yourself, or use `<SafeTypeInput>` / `use:safeType`.
 *
 * ```ts
 * const [field, setField] = createSignal<HTMLTextAreaElement>();
 * const { result, message } = useSafeType(field, { mode: "warn" });
 * <textarea ref={setField} />
 * ```
 */
export function useSafeType(target: Accessor<HTMLElement | null | undefined>, options: MaybeAccessor<UseSafeTypeOptions> = {}): UseSafeTypeReturn {
  const engine = useEngine(options);
  const opts = () => access(options);
  const [result, setResult] = createSignal<ModerationResult>();
  let instance: SafeTypeInstance | null = null;

  createEffect(() => {
    const element = target();
    if (!element) return;
    const current = attach(element, engine, opts, false, (r) => setResult(() => r));
    instance = current;
    onCleanup(() => {
      current.destroy();
      if (instance === current) instance = null;
    });
  });

  const message = createMemo<SafeTypeMessage | null>(() => {
    const r = result();
    const level = r ? getMessageLevel(r) : null;
    return r && level ? { level, text: resolveMessage(level, opts().messages, r) } : null;
  });

  const validate = () => {
    const outcome = instance?.validate();
    const first = outcome?.results[0]?.result;
    if (first) setResult(() => first);
    return { valid: outcome?.valid ?? true, result: first };
  };

  return { result, message, validate, engine };
}
