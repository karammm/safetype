import {
  createModerationEngine,
  pickEngineConfig,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationEngine,
} from "@safetype/core";
import { createComponent, createContext, createEffect, on, useContext, type JSX } from "solid-js";

/** Engine options. Read once, except `mode` and `policy`, which update live. */
export type EngineOptions = Pick<EngineConfig, EngineConfigKey> & {
  /** Use this engine instead of the provider's or a new one. */
  engine?: ModerationEngine;
};

/** A value or a function returning it (Solid props and signals both work). */
export type MaybeAccessor<T> = T | (() => T);

export function access<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

export interface SharedEngine {
  engine: ModerationEngine;
  config: EngineConfig;
}

export const SafeTypeContext = createContext<SharedEngine>();

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

export type SafeTypeProviderProps = EngineOptions & { children?: JSX.Element };

/**
 * Shares one engine with every SafeType component, primitive and directive below it.
 *
 * ```ts
 * <SafeTypeProvider mode="mask" language="hi">
 *   <App />
 * </SafeTypeProvider>
 * ```
 */
export function SafeTypeProvider(props: SafeTypeProviderProps): JSX.Element {
  const config = pickEngineConfig(props);
  const shared: SharedEngine = { engine: props.engine ?? createModerationEngine(config), config };
  if (!props.engine) syncEngine(shared.engine, () => props);
  return createComponent(SafeTypeContext.Provider, {
    value: shared,
    get children() {
      return props.children;
    },
  });
}

/** The shared engine from `<SafeTypeProvider>`, if any. */
export function useSafeTypeEngine(): ModerationEngine | undefined {
  return useContext(SafeTypeContext)?.engine;
}

/** Keeps an engine's mode and policy in sync with reactive options. */
function syncEngine(engine: ModerationEngine, options: () => EngineOptions): void {
  createEffect(
    on(
      () => options().mode,
      (mode) => mode && engine.setMode(mode),
      { defer: true },
    ),
  );
  createEffect(
    on(
      () => JSON.stringify(options().policy ?? null),
      () => {
        const policy = options().policy;
        if (policy) engine.setPolicy(policy);
      },
      { defer: true },
    ),
  );
}

/** Resolves the engine inside a component and keeps a private engine's mode/policy in sync. */
export function useEngine(options: MaybeAccessor<EngineOptions>): ModerationEngine {
  const { engine, owned } = resolveEngine(access(options), useContext(SafeTypeContext));
  if (owned) syncEngine(engine, () => access(options));
  return engine;
}
