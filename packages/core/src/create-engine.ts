import { en } from "@safetype/dictionaries/en";
import { hiLatn } from "@safetype/dictionaries/hi-latn";
import { de } from "@safetype/dictionaries/de";
import { es } from "@safetype/dictionaries/es";
import { fr } from "@safetype/dictionaries/fr";
import { hi } from "@safetype/dictionaries/hi";
import { pt } from "@safetype/dictionaries/pt";
import {
  ALL_CATEGORIES,
  SEVERITY_RANK,
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
  type Severity,
  type SeverityOverrides,
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
  /** Overrides the severity of a rule (by id) or a word. Takes effect on the next moderation call. */
  setSeverity(target: string, severity: Severity): void;
  /** Removes a severity override. Returns false when none was set for `target`. */
  resetSeverity(target: string): boolean;
  /** Current severity overrides, keyed as they were set (word keys are normalized). */
  getSeverityOverrides(): SeverityOverrides;
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
  /** Normalized literal words of a single-token pattern, used to resolve word-keyed severity overrides. */
  words: string[];
}

/** `"(fuck*|f*ck)"` -> `["fuck", "f*ck"]`. Multi-token patterns are only addressable by rule id. */
function patternWords(pattern: string): string[] {
  const tokens = pattern.trim().split(/\s+/);
  if (tokens.length !== 1) return [];
  return tokens[0]!
    .replace(/^\(|\)\??$/g, "")
    .split("|")
    .map((alt) => normalizeTerm(alt.replace(/\*$/, "")))
    .filter(Boolean);
}

const BUILT_IN_PACKS: Readonly<Record<string, DictionaryPack>> = { en, "hi-latn": hiLatn, hi, es, fr, de, pt };

/**
 * Packs enabled by `language` when `languages` is not given. English includes Hinglish (romanized Hindi),
 * which is common in English-language apps; Hindi includes both scripts. Other languages are single packs.
 */
const DEFAULT_LANGUAGES: Readonly<Record<string, readonly string[]>> = { en: ["en", "hi-latn"], hi: ["hi", "hi-latn"] };

function resolveDefaultPacks(language: string, languages: readonly string[] | undefined): DictionaryPack[] {
  const tag = language.toLowerCase();
  // An exact pack tag ("hi-Latn") wins over the defaults of its base language ("hi").
  const names =
    languages ?? (BUILT_IN_PACKS[tag] && !DEFAULT_LANGUAGES[tag] ? [tag] : DEFAULT_LANGUAGES[tag.split("-")[0]!] ?? [language]);
  return names.map((name) => {
    const key = name.toLowerCase();
    const pack = BUILT_IN_PACKS[key] ?? BUILT_IN_PACKS[key.split("-")[0]!];
    if (!pack) {
      throw new Error(`No built-in dictionary pack for language "${name}". Pass one via the \`packs\` option.`);
    }
    return pack;
  });
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

function assertSeverity(severity: Severity): void {
  if (!(severity in SEVERITY_RANK)) throw new TypeError(`Unknown severity "${String(severity)}"`);
}

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
    rules.set(rule.id, { source: { ...rule }, compiled: compileRule(rule, boundary), words: patternWords(rule.pattern) });
    index = null;
  };

  for (const pack of config.packs ?? resolveDefaultPacks(language, config.languages)) {
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

  // Rule ids are kept verbatim; anything else is treated as a word and normalized like dictionary values.
  const severityOverrides = new Map<string, Severity>();
  const severityKey = (target: string): string => {
    if (typeof target !== "string" || target.trim() === "") throw new TypeError("Severity target must be a non-empty string");
    return rules.has(target) || severityOverrides.has(target) ? target : normalizeTerm(target.trim());
  };
  const putSeverity = (target: string, severity: Severity) => {
    assertSeverity(severity);
    severityOverrides.set(severityKey(target), severity);
  };
  for (const [target, severity] of Object.entries(config.severity ?? {})) putSeverity(target, severity);

  function resolveSeverity(rule: CompiledRule, matchedText: string): Severity {
    if (severityOverrides.size === 0) return rule.severity;
    const byId = severityOverrides.get(rule.id);
    if (byId) return byId;
    const byText = severityOverrides.get(normalizeTerm(matchedText));
    if (byText) return byText;
    for (const word of rules.get(rule.id)?.words ?? []) {
      const byWord = severityOverrides.get(word);
      if (byWord) return byWord;
    }
    return rule.severity;
  }

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
      const matchedText = text.slice(s.start, s.end);
      const severity = resolveSeverity(rule, matchedText);
      const decision = decide(policies[rule.category], severity, s.confidence);
      if (!decision.keep) continue;
      let action = forceAction && decision.action !== "allow" ? forceAction : decision.action;
      // Masking a hateful or harassing *phrase* hides intent without fixing it; flag it instead. This covers
      // multi-token rules and multi-word findings from contextual classifiers (which have no pattern).
      const phrase = rule.elements.length > 1 || (rule.elements.length === 0 && /\s/.test(text.slice(s.start, s.end).trim()));
      if (action === "mask" && phrase && (rule.category === "hate" || rule.category === "harassment" || rule.category === "sexual")) {
        action = "warn";
      }
      const match: ModerationMatch = {
        start: s.start,
        end: s.end,
        text: matchedText,
        category: rule.category,
        ruleId: rule.id,
        severity,
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

    setSeverity(target, severity) {
      putSeverity(target, severity);
    },

    resetSeverity(target) {
      return severityOverrides.delete(severityKey(target));
    },

    getSeverityOverrides() {
      return Object.fromEntries(severityOverrides);
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
