import type { ModerationResult } from "@safetype/core";
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useEngine, type EngineOptions } from "./engine";

/** Reactive moderation of a string (previews, chat bubbles, pre-send checks). No DOM involved. */
export function useModeration(text: MaybeRefOrGetter<string>, options: MaybeRefOrGetter<EngineOptions> = {}): ComputedRef<ModerationResult> {
  const engine = useEngine(options);
  return computed(() => {
    // Track mode/policy so a live change re-moderates.
    void toValue(options).mode;
    void JSON.stringify(toValue(options).policy ?? null);
    return engine.moderate(toValue(text));
  });
}
