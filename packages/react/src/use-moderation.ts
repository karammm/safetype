import type { ModerationResult } from "@safetype/core";
import { useMemo } from "react";
import { useEngine, type EngineOptions } from "./engine";

/**
 * Moderates a string during render, e.g. for previews, chat bubbles, or validating state before sending.
 * Pure and synchronous; no DOM involved.
 */
export function useModeration(text: string, options: EngineOptions = {}): ModerationResult {
  const engine = useEngine(options);
  const policyKey = JSON.stringify(options.policy ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => engine.moderate(text), [engine, text, options.mode, policyKey]);
}
