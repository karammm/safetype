import type { ModerationEngine, ModerationResult } from "@safetype/core";
import {
  createSafeType,
  getMessageLevel,
  resolveMessage,
  type MessageLevel,
  type SafeTypeInstance,
  type SafeTypeOptions,
} from "@safetype/dom";
import { computed, onScopeDispose, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue";
import { useEngine, type EngineOptions } from "./engine";

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
  result: ShallowRef<ModerationResult | undefined>;
  message: ComputedRef<SafeTypeMessage | null>;
  /** Final pass (masks pending words); `valid` is false when the content is blocked. */
  validate: () => { valid: boolean; result: ModerationResult | undefined };
  engine: ModerationEngine;
}

type Target = HTMLElement | { $el: unknown } | null | undefined;

function resolveElement(target: Target): HTMLElement | null {
  if (!target) return null;
  if (typeof (target as { $el?: unknown }).$el !== "undefined") return resolveElement((target as { $el: Target }).$el);
  return (target as Node).nodeType === 1 ? (target as HTMLElement) : null;
}

/**
 * Moderates the element in a template ref. Messages are not rendered by default
 * (`showMessages: false`): render `message` yourself, or use `<SafeTypeInput>` / `v-safe-type`.
 *
 * ```ts
 * const field = ref<HTMLTextAreaElement>();
 * const { result, message } = useSafeType(field, { mode: "warn" });
 * ```
 */
export function useSafeType(target: MaybeRefOrGetter<Target>, options: MaybeRefOrGetter<UseSafeTypeOptions> = {}): UseSafeTypeReturn {
  const engine = useEngine(options);
  const result = shallowRef<ModerationResult>();
  let instance: SafeTypeInstance | null = null;
  const opts = () => toValue(options);

  const stop = watch(
    () => resolveElement(toValue(target)),
    (element) => {
      instance?.destroy();
      instance = null;
      if (!element) return;
      const initial = opts();
      instance = createSafeType({
        engine,
        root: element,
        observeDynamicElements: false,
        showMessages: initial.showMessages ?? false,
        messages: {
          get warn() {
            return opts().messages?.warn;
          },
          get block() {
            return opts().messages?.block;
          },
        },
        blockSubmit: initial.blockSubmit,
        asyncModeration: initial.asyncModeration ?? (initial.classifiers?.length ?? 0) > 0,
        asyncDebounceMs: initial.asyncDebounceMs,
        onModerated: (r, el) => {
          result.value = r;
          opts().onModerated?.(r, el);
        },
        onViolation: (r, el) => opts().onViolation?.(r, el),
        onWarning: (r, el) => opts().onWarning?.(r, el),
        onBlocked: (r, el) => opts().onBlocked?.(r, el),
        onError: (error, el) => {
          const handler = opts().onError;
          if (handler) handler(error, el);
          else console.error("[safetype]", error);
        },
      });
      instance.start();
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => {
    stop();
    instance?.destroy();
    instance = null;
  });

  const message = computed<SafeTypeMessage | null>(() => {
    const r = result.value;
    const level = r ? getMessageLevel(r) : null;
    return r && level ? { level, text: resolveMessage(level, opts().messages, r) } : null;
  });

  const validate = () => {
    const outcome = instance?.validate();
    const first = outcome?.results[0]?.result;
    if (first) result.value = first;
    return { valid: outcome?.valid ?? true, result: first };
  };

  return { result, message, validate, engine };
}
