import type { EngineConfig } from "@safetype/shared";

/** Engine options that framework bindings accept as props. */
export const ENGINE_CONFIG_KEYS = [
  "mode", "language", "languages", "categories", "policy", "packs", "customWords", "allowList", "rules", "severity",
  "maskChar", "maskStyle", "detectSpacedLetters", "classifiers", "classifierTimeoutMs",
] as const;

export type EngineConfigKey = (typeof ENGINE_CONFIG_KEYS)[number];

/** Picks the defined engine options out of a props-like object. */
export function pickEngineConfig(source: object): Pick<EngineConfig, EngineConfigKey> {
  const config: Record<string, unknown> = {};
  for (const key of ENGINE_CONFIG_KEYS) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) config[key] = value;
  }
  return config as Pick<EngineConfig, EngineConfigKey>;
}
