import type { ModerationAction, ModerationEngine } from "@safetype/core";
import { createSafeType, type SafeTypeInstance } from "@safetype/dom";
import type { Directive, DirectiveBinding } from "vue";
import { resolveEngine, type SharedEngine } from "./engine";
import type { UseSafeTypeOptions } from "./use-safe-type";

/** `v-safe-type` value. The directive renders messages after the element by default. */
export type SafeTypeDirectiveValue = UseSafeTypeOptions | ModerationAction | undefined;

interface State {
  instance: SafeTypeInstance;
  engine: ModerationEngine;
  owned: boolean;
  options: UseSafeTypeOptions;
  policyKey: string;
}

const MODES = new Set(["allow", "mask", "suggest", "warn", "block"]);

/** `v-safe-type:warn` is shorthand for `v-safe-type="{ mode: 'warn' }"`; a string value is a mode too. */
function normalize(binding: DirectiveBinding<SafeTypeDirectiveValue>): UseSafeTypeOptions {
  const value = binding.value;
  const options: UseSafeTypeOptions = typeof value === "string" ? { mode: value } : { ...value };
  if (binding.arg && MODES.has(binding.arg) && !options.mode) options.mode = binding.arg as ModerationAction;
  return options;
}

export function createSafeTypeDirective(shared?: SharedEngine): Directive<HTMLElement, SafeTypeDirectiveValue> {
  const states = new WeakMap<HTMLElement, State>();
  return {
    mounted(el, binding) {
      const options = normalize(binding);
      const { engine, owned } = resolveEngine(options, shared);
      const state = { engine, owned, options, policyKey: JSON.stringify(options.policy ?? null) } as State;
      const opts = () => state.options;
      state.instance = createSafeType({
        engine,
        root: el,
        observeDynamicElements: false,
        showMessages: options.showMessages ?? true,
        messages: {
          get warn() {
            return opts().messages?.warn;
          },
          get block() {
            return opts().messages?.block;
          },
        },
        blockSubmit: options.blockSubmit,
        asyncModeration: options.asyncModeration,
        asyncDebounceMs: options.asyncDebounceMs,
        onModerated: (r, target) => opts().onModerated?.(r, target),
        onViolation: (r, target) => opts().onViolation?.(r, target),
        onWarning: (r, target) => opts().onWarning?.(r, target),
        onBlocked: (r, target) => opts().onBlocked?.(r, target),
        onError: (error, target) => {
          const handler = opts().onError;
          if (handler) handler(error, target);
          else console.error("[safetype]", error);
        },
      });
      state.instance.start();
      states.set(el, state);
    },
    updated(el, binding) {
      const state = states.get(el);
      if (!state) return;
      const options = normalize(binding);
      state.options = options;
      if (!state.owned) return;
      if (options.mode) state.engine.setMode(options.mode);
      const policyKey = JSON.stringify(options.policy ?? null);
      if (policyKey !== state.policyKey && options.policy) state.engine.setPolicy(options.policy);
      state.policyKey = policyKey;
    },
    beforeUnmount(el) {
      const state = states.get(el);
      states.delete(el);
      // Defer cleanup until Vue's patch is done: Vue may have picked our message node (the element's
      // next sibling) as the insertion anchor for whatever replaces this element (e.g. v-if/v-else).
      if (state) queueMicrotask(() => state.instance.destroy());
    },
  };
}

/** Standalone directive (uses its own engine unless options pass one). Register globally via `SafeTypePlugin`. */
export const vSafeType = createSafeTypeDirective();
