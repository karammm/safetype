import { createModerationEngine, type EngineConfig, type ModerationEngine } from "@safetype/core";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Engine options a component may pass. Read once on mount, except `mode` and `policy`, which update live. */
export type EngineOptions = Pick<
  EngineConfig,
  | "mode"
  | "language"
  | "categories"
  | "policy"
  | "packs"
  | "customWords"
  | "allowList"
  | "rules"
  | "maskChar"
  | "maskStyle"
  | "detectSpacedLetters"
  | "classifiers"
  | "classifierTimeoutMs"
> & {
  /** Use this engine instead of the provider's or a new one. */
  engine?: ModerationEngine;
};

const ENGINE_KEYS = [
  "mode", "language", "categories", "policy", "packs", "customWords", "allowList", "rules",
  "maskChar", "maskStyle", "detectSpacedLetters", "classifiers", "classifierTimeoutMs",
] as const;

export function pickEngineConfig(options: Record<string, unknown>): EngineConfig {
  const config: Record<string, unknown> = {};
  for (const key of ENGINE_KEYS) if (options[key] !== undefined) config[key] = options[key];
  return config as EngineConfig;
}

interface ContextValue {
  engine: ModerationEngine;
  config: EngineConfig;
}

const SafeTypeContext = createContext<ContextValue | null>(null);

/** Keeps a self-owned engine's mode and policy in sync with props. */
function useLiveUpdates(engine: ModerationEngine | null, config: EngineConfig): void {
  const policyKey = JSON.stringify(config.policy ?? null);
  useEffect(() => {
    if (engine && config.mode) engine.setMode(config.mode);
  }, [engine, config.mode]);
  useEffect(() => {
    if (engine && config.policy) engine.setPolicy(config.policy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, policyKey]);
}

export interface SafeTypeProviderProps extends EngineOptions {
  children?: ReactNode;
}

/** Shares one moderation engine (and its configuration) with every SafeType component below it. */
export function SafeTypeProvider({ children, engine: providedEngine, ...options }: SafeTypeProviderProps) {
  const config = pickEngineConfig(options);
  const [own] = useState(() => (providedEngine ? null : createModerationEngine(config)));
  useLiveUpdates(own, config);
  const engine = providedEngine ?? own!;
  const [value, setValue] = useState<ContextValue>({ engine, config });
  useEffect(() => {
    if (value.engine !== engine) setValue({ engine, config });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);
  return <SafeTypeContext.Provider value={value}>{children}</SafeTypeContext.Provider>;
}

/**
 * Resolves the engine for a hook or component:
 * an explicit `engine` prop, else a private engine when engine options are given
 * (inheriting the provider's configuration), else the provider's engine, else a default engine.
 */
export function useEngine(options: EngineOptions): ModerationEngine {
  const context = useContext(SafeTypeContext);
  const own = pickEngineConfig(options as Record<string, unknown>);
  const hasOwn = Object.keys(own).length > 0;
  const [created] = useState(() =>
    options.engine || (!hasOwn && context) ? null : createModerationEngine({ ...context?.config, ...own }),
  );
  useLiveUpdates(created, own);
  return options.engine ?? created ?? context!.engine;
}

/** The engine from the nearest `<SafeTypeProvider>`, or undefined. */
export function useSafeTypeEngine(): ModerationEngine | undefined {
  return useContext(SafeTypeContext)?.engine;
}
