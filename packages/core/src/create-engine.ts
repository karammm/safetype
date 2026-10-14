import { en } from "@safetype/dictionaries/en";
import {
  ALL_CATEGORIES,
  type AsyncModerationResult,
  type ClassifierInput,
  type ClassifierOutput,
  type ContextualClassifier,
  type DictionaryPack,
  type EngineConfig,
  type MatchContext,
  type ModerateAsyncOptions,
  type ModerationAction,
  type ModerationCategory,
  type ModerationEvents,
  type ModerationMatch,
  type ModerationResult,
  type ModerationRule,
  type ModerationSession,
  type PolicyMap,
  type SessionOptions,
  type TextEdit,
  type ValidationResult,
} from "@safetype/shared";
import { CONTEXT_FACTOR, detectContext, findQuotedRanges } from "./engine/classifier";
import { Emitter, type Handler } from "./engine/emitter";
import { compileRule, DEFAULT_PRIORITY, findMatches, RuleIndex, type CompiledRule, type RawMatch } from "./engine/matcher";
import { normalize, normalizeTerm } from "./engine/normalizer";
import {
  applyPolicyOverrides,
  assertAction,
  decide,
  defaultPolicies,
  mostRestrictive,
  type ResolvedPolicies,
} from "./engine/policy-engine";
import { createSession, isAbortError } from "./engine/session";
import { mergeSpacedLetters, tokenize } from "./engine/tokenizer";
import { applyEdits, maskText, matchCase } from "./engine/transformer";

export interface ModerationEngine {
  /** Synchronous, rule-based moderation. Never sends text anywhere. */
  moderate(text: string): ModerationResult;
  /** Rule-based moderation followed by the configured contextual classifiers. */
  moderateAsync(text: string, options?: ModerateAsyncOptions): Promise<AsyncModerationResult>;
  /** Returns the text with every actionable match masked, regardless of the configured action. */
  mask(text: string): string;
  /** Server-side friendly check: `valid` is false when the policy blocks the content. */
  validate(text: string): ValidationResult;
  addRule(rule: ModerationRule): void;
  removeRule(id: string): boolean;
  getRules(): ModerationRule[];
  /** Merges per-category overrides into the current policy. */
  setPolicy(policy: PolicyMap): void;
  /** Changes the global mode and recomputes defaults (explicit overrides are kept). */
  setMode(mode: ModerationAction): void;
  on<K extends keyof ModerationEvents>(event: K, handler: Handler<ModerationEvents[K]>): () => void;
  /** Latest-only async moderation for live typing, with optional debounce. */
  createSession(options?: SessionOptions): ModerationSession;
}

interface ScoredMatch extends RawMatch {
  context: MatchContext;
}

interface StoredRule {
  source: ModerationRule;
  compiled: CompiledRule;
}

const BUILT_IN_PACKS: Readonly<Record<string, DictionaryPack>> = { en };

function resolveDefaultPack(language: string): DictionaryPack {
  const pack = BUILT_IN_PACKS[language.toLowerCase().split("-")[0]!];
  if (!pack) {
    throw new Error(`No built-in dictionary pack for language "${language}". Pass one via the \`packs\` option.`);
  }
  return pack;
}

function abortError(signal?: AbortSignal): unknown {
  if (signal?.reason !== undefined) return signal.reason;
  return new DOMException("The operation was aborted.", "AbortError");
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

const CATEGORY_SET = new Set<ModerationCategory>(ALL_CATEGORIES);

export function createModerationEngine(config: EngineConfig = {}): ModerationEngine {
  let mode: ModerationAction = config.mode ?? "mask";
  assertAction(mode);
  const language = config.language ?? "en";
  const categories = config.categories ?? ALL_CATEGORIES;
  for (const c of categories) if (!CATEGORY_SET.has(c)) throw new TypeError(`Unknown category "${String(c)}"`);
  const maskChar = config.maskChar ?? "*";
  if (Array.from(maskChar).length !== 1 || /[\p{L}\p{N}\s]/u.test(maskChar)) {
    throw new TypeError("maskChar must be a single non-letter, non-digit, non-space character");
  }
  const maskStyle = config.maskStyle ?? "vowels";
  const detectSpaced = config.detectSpacedLetters ?? true;
  const classifiers: readonly ContextualClassifier[] = config.classifiers ?? [];
  const defaultTimeout = config.classifierTimeoutMs ?? 3000;

  const emitter = new Emitter<ModerationEvents>((error, event) => {
    if (event !== "error") emitter.emit("error", { error });
  });
  if (config.onModerated) emitter.on("moderated", config.onModerated);
  if (config.onViolation) emitter.on("violation", config.onViolation);
  if (config.onBlocked) emitter.on("blocked", config.onBlocked);
  if (config.onWarning) emitter.on("warning", config.onWarning);
  if (config.onError) emitter.on("error", config.onError);

  const rules = new Map<string, StoredRule>();
  const allowList = new Set<string>();
  let index: RuleIndex | null = null;

  const putRule = (rule: ModerationRule, boundary: "word" | "substring" = "word") => {
    rules.set(rule.id, { source: { ...rule }, compiled: compileRule(rule, boundary) });
    index = null;
  };

  for (const pack of config.packs ?? [resolveDefaultPack(language)]) {
    for (const rule of pack.rules) putRule(rule, pack.boundary ?? "word");
    for (const word of pack.allowList ?? []) allowList.add(normalizeTerm(word));
  }
  for (const word of config.customWords ?? []) {
    const pattern = word.replace(/[()|?]/g, "").trim().split(/\s+/).join(" ");
    if (!pattern) continue;
    putRule({ id: `custom.${normalizeTerm(pattern).replace(/\s+/g, "-")}`, pattern, category: "custom", severity: "medium" });
  }
  for (const rule of config.rules ?? []) putRule(rule);
  for (const word of config.allowList ?? []) allowList.add(normalizeTerm(word));

  let overrides: PolicyMap = { ...config.policy };
  let policies: ResolvedPolicies = applyPolicyOverrides(defaultPolicies(mode, categories), overrides);

  const getIndex = (): RuleIndex => {
    if (!index) index = new RuleIndex(Array.from(rules.values(), (r) => r.compiled));
    return index;
  };

  function analyze(text: string): ScoredMatch[] {
    const normalized = normalize(text);
    const tokens = tokenize(normalized, maskChar);
    const spaced = detectSpaced ? mergeSpacedLetters(tokens, normalized.text) : [];
    const raw = findMatches(getIndex(), { normalized, tokens, spaced, allowList });
    if (raw.length === 0) return [];
    const quoted = findQuotedRanges(text);
    return raw.map((m) => {
      const context = detectContext(m, tokens, quoted);
      return { ...m, context, confidence: round(m.confidence * CONTEXT_FACTOR[context]) };
    });
  }

  /** Greedy, deterministic selection of non-overlapping matches: priority, length, position, rule id. */
  function selectNonOverlapping(matches: ModerationMatch[]): ModerationMatch[] {
    const ordered = [...matches].sort(
      (a, b) =>
        b.priority - a.priority ||
        b.end - b.start - (a.end - a.start) ||
        a.start - b.start ||
        (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
    );
    const accepted: ModerationMatch[] = [];
    for (const m of ordered) {
      if (accepted.every((a) => m.end <= a.start || m.start >= a.end)) accepted.push(m);
    }
    return accepted;
  }

  function finalize(text: string, scored: readonly ScoredMatch[], forceAction?: ModerationAction): ModerationResult {
    const matches: ModerationMatch[] = [];
    for (const s of scored) {
      const rule = s.rule;
      const decision = decide(policies[rule.category], rule.severity, s.confidence);
      if (!decision.keep) continue;
      let action = forceAction && decision.action !== "allow" ? forceAction : decision.action;
      // Masking a hateful or harassing *phrase* hides intent without fixing it; flag it instead.
      if (action === "mask" && rule.elements.length > 1 && (rule.category === "hate" || rule.category === "harassment")) {
        action = "warn";
      }
      const matchedText = text.slice(s.start, s.end);
      const match: ModerationMatch = {
        start: s.start,
        end: s.end,
        text: matchedText,
        category: rule.category,
        ruleId: rule.id,
        severity: rule.severity,
        confidence: s.confidence,
        priority: rule.priority,
        context: s.context,
        action,
        requiresReview: decision.requiresReview,
        applied: false,
      };
      if (rule.replacement !== undefined) match.suggestedReplacement = matchCase(matchedText, rule.replacement);
      else if (action === "suggest") match.suggestedReplacement = maskText(matchedText, maskStyle, maskChar);
      if (rule.label !== undefined) match.label = rule.label;
      if (s.source !== undefined) match.source = s.source;
      matches.push(match);
    }
    matches.sort((a, b) => a.start - b.start || a.end - b.end || b.priority - a.priority);

    const maskEdits = selectNonOverlapping(matches.filter((m) => m.action === "mask"));
    const suggestEdits = selectNonOverlapping(matches.filter((m) => m.action === "mask" || m.action === "suggest"));
    const toEdit = (m: ModerationMatch): TextEdit => ({
      start: m.start,
      end: m.end,
      replacement:
        m.action === "suggest" && m.suggestedReplacement !== undefined
          ? m.suggestedReplacement
          : maskText(m.text, maskStyle, maskChar),
    });
    for (const m of maskEdits) m.applied = true;
    for (const m of suggestEdits) if (m.action === "suggest") m.applied = true;

    const masked = applyEdits(text, maskEdits.map(toEdit));
    const suggested = applyEdits(text, suggestEdits.map(toEdit));
    const action = mostRestrictive(matches.map((m) => m.action));
    return {
      originalText: text,
      text: masked.text,
      suggestedText: suggested.text,
      matches,
      allowed: action !== "block",
      action,
      requiresReview: matches.some((m) => m.requiresReview),
      mapping: masked.mapping,
    };
  }

  function emitResult(result: ModerationResult): void {
    emitter.emit("moderated", result);
    if (result.matches.some((m) => m.action !== "allow")) emitter.emit("violation", result);
    if (result.action === "block") emitter.emit("blocked", result);
    if (result.matches.some((m) => m.action === "warn")) emitter.emit("warning", result);
  }

  async function runClassifier(
    classifier: ContextualClassifier,
    input: Omit<ClassifierInput, "signal">,
    timeoutMs: number,
    parent?: AbortSignal,
  ): Promise<ClassifierOutput> {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort(abortError(parent));
    parent?.addEventListener("abort", onParentAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<ClassifierOutput>((resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
        timer = setTimeout(() => {
          const error = new Error(`Classifier "${classifier.name}" timed out after ${timeoutMs}ms`);
          error.name = "TimeoutError";
          controller.abort(error);
        }, timeoutMs);
        Promise.resolve()
          .then(() => classifier.classify({ ...input, signal: controller.signal }))
          .then(resolve, reject);
      });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    }
  }

  function mergeClassifierOutput(text: string, scored: ScoredMatch[], name: string, output: ClassifierOutput): void {
    for (const adj of output.adjustments ?? []) {
      const target = scored.find((s) => s.rule.id === adj.ruleId && s.start === adj.start);
      if (target && Number.isFinite(adj.confidence)) target.confidence = round(clamp01(adj.confidence));
    }
    for (const m of output.matches ?? []) {
      if (!CATEGORY_SET.has(m.category)) continue;
      if (!(Number.isInteger(m.start) && Number.isInteger(m.end) && m.start >= 0 && m.end <= text.length && m.start < m.end)) {
        continue;
      }
      const rule: CompiledRule = {
        id: `${name}:${m.label ?? m.category}`,
        category: m.category,
        severity: m.severity ?? "medium",
        confidence: clamp01(m.confidence),
        priority: DEFAULT_PRIORITY[m.category],
        replacement: m.replacement,
        label: m.label,
        boundary: "word",
        elements: [],
      };
      scored.push({ start: m.start, end: m.end, rule, confidence: round(rule.confidence), context: "direct", source: name });
    }
  }

  const engine: ModerationEngine = {
    moderate(text) {
      const result = finalize(text, analyze(text));
      emitResult(result);
      return result;
    },

    async moderateAsync(text, options = {}) {
      const { signal } = options;
      if (signal?.aborted) throw abortError(signal);
      const scored = analyze(text);
      const providers: string[] = [];
      const failedProviders: string[] = [];

      if (classifiers.length > 0) {
        const preliminary = finalize(text, scored);
        const timeoutMs = options.timeoutMs ?? defaultTimeout;
        const settled = await Promise.all(
          classifiers.map((classifier) =>
            runClassifier(classifier, { text, matches: preliminary.matches, language }, timeoutMs, signal).then(
              (output) => ({ classifier, output, error: undefined as unknown }),
              (error: unknown) => ({ classifier, output: undefined, error }),
            ),
          ),
        );
        if (signal?.aborted) throw abortError(signal);
        for (const { classifier, output, error } of settled) {
          if (output) {
            mergeClassifierOutput(text, scored, classifier.name, output);
            providers.push(classifier.name);
          } else {
            failedProviders.push(classifier.name);
            emitter.emit("error", { error, provider: classifier.name });
          }
        }
      }

      const result: AsyncModerationResult = { ...finalize(text, scored), providers, failedProviders };
      emitResult(result);
      return result;
    },

    mask(text) {
      return finalize(text, analyze(text), "mask").text;
    },

    validate(text) {
      const result = engine.moderate(text);
      return {
        valid: result.allowed,
        result,
        violations: result.matches.filter((m) => m.action !== "allow"),
      };
    },

    addRule(rule) {
      putRule(rule);
    },

    removeRule(id) {
      const removed = rules.delete(id);
      if (removed) index = null;
      return removed;
    },

    getRules() {
      return Array.from(rules.values(), (r) => ({ ...r.source }));
    },

    setPolicy(policy) {
      const merged: PolicyMap = { ...overrides };
      for (const category of ALL_CATEGORIES) {
        const next = policy[category];
        if (next) merged[category] = { ...merged[category], ...next };
      }
      policies = applyPolicyOverrides(defaultPolicies(mode, categories), merged);
      overrides = merged;
    },

    setMode(nextMode) {
      assertAction(nextMode);
      mode = nextMode;
      policies = applyPolicyOverrides(defaultPolicies(mode, categories), overrides);
    },

    on(event, handler) {
      return emitter.on(event, handler);
    },

    createSession(options) {
      return createSession((text, opts) => engine.moderateAsync(text, opts), options);
    },
  };

  return engine;
}
