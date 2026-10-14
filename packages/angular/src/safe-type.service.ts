import { Injectable, InjectionToken, inject, makeEnvironmentProviders, type EnvironmentProviders } from "@angular/core";
import {
  createModerationEngine,
  pickEngineConfig,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationEngine,
  type ModerationResult,
  type ValidationResult,
} from "@safetype/core";

/** Engine options. Read once, except `mode` and `policy` on directives, which update live. */
export type SafeTypeEngineOptions = Pick<EngineConfig, EngineConfigKey> & {
  /** Use this engine instead of creating one. */
  engine?: ModerationEngine;
};

export const SAFE_TYPE_CONFIG = new InjectionToken<SafeTypeEngineOptions>("SAFE_TYPE_CONFIG");

/** App-wide moderation engine. Configure it with `provideSafeType()`. */
@Injectable({ providedIn: "root" })
export class SafeTypeService {
  readonly config: EngineConfig;
  readonly engine: ModerationEngine;

  constructor() {
    const options = inject(SAFE_TYPE_CONFIG, { optional: true }) ?? {};
    this.config = pickEngineConfig(options);
    this.engine = options.engine ?? createModerationEngine(this.config);
  }

  moderate(text: string): ModerationResult {
    return this.engine.moderate(text);
  }

  validate(text: string): ValidationResult {
    return this.engine.validate(text);
  }

  mask(text: string): string {
    return this.engine.mask(text);
  }

  /**
   * The engine for a directive: an explicit `engine`, else a private engine when engine options are
   * given (inheriting this service's configuration), else this service's engine.
   */
  resolve(options: SafeTypeEngineOptions): { engine: ModerationEngine; owned: boolean } {
    if (options.engine) return { engine: options.engine, owned: false };
    const own = pickEngineConfig(options);
    if (Object.keys(own).length === 0) return { engine: this.engine, owned: false };
    return { engine: createModerationEngine({ ...this.config, ...own }), owned: true };
  }
}

/**
 * Configures SafeType for an application (or a lazy-loaded route's injector):
 * `bootstrapApplication(App, { providers: [provideSafeType({ mode: "mask" })] })`
 */
export function provideSafeType(options: SafeTypeEngineOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SAFE_TYPE_CONFIG, useValue: options }, SafeTypeService]);
}
