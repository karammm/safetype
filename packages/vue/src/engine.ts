import {
  createModerationEngine,
  pickEngineConfig,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationEngine,
} from "@safetype/core";
import { inject, provide, toValue, watch, type InjectionKey, type MaybeRefOrGetter } from "vue";

/** Engine options. Read once, except `mode` and `policy`, which update live. */
export type EngineOptions = Pick<EngineConfig, EngineConfigKey> & {
  /** Use this engine instead of the app's or a new one. */
  engine?: ModerationEngine;
};

export interface SharedEngine {
  engine: ModerationEngine;
  config: EngineConfig;
}

export const SAFE_TYPE_KEY: InjectionKey<SharedEngine> = Symbol("safetype");

export function createShared(options: EngineOptions = {}): SharedEngine {
  const config = pickEngineConfig(options);
  return { engine: options.engine ?? createModerationEngine(config), config };
}

/**
 * Picks the engine: an explicit `engine`, else a private engine when engine options are given
 * (inheriting the shared configuration), else the shared engine, else a default engine.
 */
export function resolveEngine(options: EngineOptions, shared: SharedEngine | undefined): { engine: ModerationEngine; owned: boolean } {
  if (options.engine) return { engine: options.engine, owned: false };
  const own = pickEngineConfig(options);
  if (Object.keys(own).length === 0 && shared) return { engine: shared.engine, owned: false };
  return { engine: createModerationEngine({ ...shared?.config, ...own }), owned: true };
}

/** Shares an engine with every SafeType component and composable in the current component's subtree. */
export function provideSafeType(options: EngineOptions = {}): ModerationEngine {
  const shared = createShared(options);
  provide(SAFE_TYPE_KEY, shared);
  return shared.engine;
}

/** The shared engine from `SafeTypePlugin` or `provideSafeType()`, if any. */
export function useSafeTypeEngine(): ModerationEngine | undefined {
  return inject(SAFE_TYPE_KEY, undefined)?.engine;
}

/** Resolves the engine inside `setup()` and keeps a private engine's mode/policy in sync. */
export function useEngine(options: MaybeRefOrGetter<EngineOptions>): ModerationEngine {
  const { engine, owned } = resolveEngine(toValue(options), inject(SAFE_TYPE_KEY, undefined));
  if (owned) {
    watch(
      () => toValue(options).mode,
      (mode) => mode && engine.setMode(mode),
    );
    watch(
      () => JSON.stringify(toValue(options).policy ?? null),
      () => {
        const policy = toValue(options).policy;
        if (policy) engine.setPolicy(policy);
      },
    );
  }
  return engine;
}
