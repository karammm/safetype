import {
  ALL_CATEGORIES,
  createModerationEngine,
  pickEngineConfig,
  type AsyncModerationResult,
  type ClassifierOutput,
  type ContextualClassifier,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationCategory,
  type ModerationEngine,
  type ModerationMatch,
} from "@safetype/core";

export interface ModerationServiceOptions extends Pick<EngineConfig, EngineConfigKey> {
  /** Server-side contextual classifiers (e.g. `anthropicClassifier`, `llmClassifier`). */
  classifiers?: ContextualClassifier[];
  /** Use an existing engine for `check()` (classifiers are still taken from this options object). */
  engine?: ModerationEngine;
  /** Reject texts longer than this (HTTP 413). Default 4000 characters. */
  maxTextLength?: number;
  /** Per-classifier timeout. Default 8000 ms. */
  timeoutMs?: number;
  /** Cache identical classify requests (saves model cost on retyped/pasted text). Default 500 entries; 0 disables. */
  cacheSize?: number;
  /**
   * Decide whether a classify request may run (auth, rate limiting, quotas). Receives the framework request.
   * The classify endpoint spends model tokens: protect it like any paid API.
   */
  authorize?: (request: unknown) => boolean | Promise<boolean>;
  onError?: (error: unknown) => void;
}

export interface ServiceResponse {
  status: number;
  body: unknown;
}

export interface ModerationService {
  readonly engine: ModerationEngine;
  /** Handles a `remoteClassifier` request body; returns an HTTP status and JSON body. */
  classify(body: unknown, request?: unknown): Promise<ServiceResponse>;
  /** Full server-side check (rules + classifiers) for enforcement before storing content. */
  check(text: string): Promise<AsyncModerationResult>;
}

class LRU<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly size: number) {}
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    if (this.size <= 0) return;
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.size) this.map.delete(this.map.keys().next().value!);
  }
}

const CATEGORIES = new Set<string>(ALL_CATEGORIES);

function toMatches(value: unknown): ModerationMatch[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((m): ModerationMatch[] => {
    if (!m || typeof m !== "object") return [];
    const { ruleId, start, end, category, confidence, text } = m as Record<string, unknown>;
    if (typeof ruleId !== "string" || typeof start !== "number" || typeof end !== "number" || typeof text !== "string") return [];
    if (!CATEGORIES.has(String(category))) return [];
    return [
      {
        ruleId: ruleId.slice(0, 100),
        start,
        end,
        text: text.slice(0, 200),
        category: category as ModerationCategory,
        confidence: typeof confidence === "number" ? confidence : 1,
        severity: "medium",
        priority: 0,
        context: "direct",
        action: "allow",
        requiresReview: false,
        applied: false,
      },
    ];
  });
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Classifier timed out after ${ms}ms`)), ms);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true })),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side moderation: answers `remoteClassifier` requests from browsers and checks submissions before
 * they are stored. Framework adapters: `expressClassifier`, `expressGuard`, `fastifySafeType`, `createFetchHandler`.
 */
export function createModerationService(options: ModerationServiceOptions = {}): ModerationService {
  const { classifiers = [], maxTextLength = 4000, timeoutMs = 8000, cacheSize = 500, authorize, onError } = options;
  const engine = options.engine ?? createModerationEngine({ ...pickEngineConfig(options), classifiers, classifierTimeoutMs: timeoutMs });
  const cache = new LRU<ClassifierOutput>(cacheSize);
  const report = (error: unknown) => (onError ? onError(error) : console.error("[safetype/ai]", error));

  return {
    engine,

    async classify(body, request) {
      if (authorize && !(await authorize(request))) return { status: 403, body: { error: "Forbidden" } };
      const data = body as Record<string, unknown> | null;
      if (!data || typeof data !== "object" || typeof data.text !== "string") {
        return { status: 400, body: { error: "Expected JSON { text, matches? }" } };
      }
      const text = data.text;
      if (text.length > maxTextLength) return { status: 413, body: { error: `Text longer than ${maxTextLength} characters` } };
      const language = typeof data.language === "string" ? data.language.slice(0, 20) : "en";
      const matches = toMatches(data.matches);
      const key = JSON.stringify([text, language, matches.map((m) => [m.ruleId, m.start, m.confidence])]);
      const cached = cache.get(key);
      if (cached) return { status: 200, body: cached };

      const settled = await Promise.allSettled(
        classifiers.map((c) => withTimeout((signal) => c.classify({ text, matches, language, signal }), timeoutMs)),
      );
      const merged: Required<ClassifierOutput> = { matches: [], adjustments: [] };
      let failures = 0;
      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          merged.matches.push(...(outcome.value.matches ?? []));
          merged.adjustments.push(...(outcome.value.adjustments ?? []));
        } else {
          failures++;
          report(outcome.reason);
        }
      }
      // Don't cache a degraded answer; the client falls back to its rule-based result on a 502.
      if (classifiers.length > 0 && failures === classifiers.length) return { status: 502, body: { error: "Classifier unavailable" } };
      if (failures === 0) cache.set(key, merged);
      return { status: 200, body: merged };
    },

    check(text) {
      return engine.moderateAsync(text);
    },
  };
}
