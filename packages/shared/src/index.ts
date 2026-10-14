/**
 * Public contracts shared by every SafeType package.
 * This module contains types plus a few constant tables and has no runtime dependencies.
 */

/** What to do with a piece of content. Ordered from least to most restrictive in {@link ACTION_SEVERITY}. */
export type ModerationAction = "allow" | "mask" | "suggest" | "warn" | "block";

export type ModerationCategory = "profanity" | "hate" | "harassment" | "custom";

export type Severity = "low" | "medium" | "high" | "critical";

export const ACTION_SEVERITY: Readonly<Record<ModerationAction, number>> = {
  allow: 0,
  mask: 1,
  suggest: 2,
  warn: 3,
  block: 4,
};

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const ALL_CATEGORIES: readonly ModerationCategory[] = ["profanity", "hate", "harassment", "custom"];

/**
 * A detection rule.
 *
 * `pattern` syntax (whitespace separated tokens):
 *  - `word`        literal token (matched after normalization, case-insensitive)
 *  - `word*`       prefix wildcard (`fuck*` matches "fucking", "fucker")
 *  - `(a|b|c)`     alternatives
 *  - `token?`      optional token (not allowed as the first token)
 */
export interface ModerationRule {
  id: string;
  pattern: string;
  category: ModerationCategory;
  severity?: Severity;
  /** Base confidence in [0, 1] before contextual adjustment. Default 1. */
  confidence?: number;
  /** Higher wins when transforming overlapping matches. Defaults by category. */
  priority?: number;
  /** Replacement offered in `suggest` mode. */
  replacement?: string;
  /** Free-form label, e.g. "slur", "threat", "insult". */
  label?: string;
}

export type MatchContext = "direct" | "quoted" | "mention";

export interface ModerationMatch {
  /** Start offset in the original text (UTF-16 code units, inclusive). */
  start: number;
  /** End offset in the original text (exclusive). */
  end: number;
  /** The original text covered by the match. */
  text: string;
  category: ModerationCategory;
  ruleId: string;
  severity: Severity;
  confidence: number;
  priority: number;
  context: MatchContext;
  /** Action the policy assigned to this specific match. */
  action: ModerationAction;
  /** True when the match was below the policy's confidence threshold and needs human review. */
  requiresReview: boolean;
  /** True when this match changed `result.text`. */
  applied: boolean;
  suggestedReplacement?: string;
  label?: string;
  /** Set when the match came from an async contextual provider. */
  source?: string;
}

/** Maps offsets between the original and the transformed text. */
export interface OffsetMapping {
  toTransformed(originalOffset: number): number;
  toOriginal(transformedOffset: number): number;
  readonly edits: readonly TextEdit[];
}

export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

export interface ModerationResult {
  originalText: string;
  /** Text after mask transformations. Unchanged for allow/warn/block/suggest. */
  text: string;
  /** Text with suggestions applied (only differs from `text` when matches have `suggest` actions). */
  suggestedText: string;
  matches: ModerationMatch[];
  /** False only when the overall action is `block`. */
  allowed: boolean;
  /** Most restrictive action across all matches. */
  action: ModerationAction;
  requiresReview: boolean;
  mapping: OffsetMapping;
}

export interface AsyncModerationResult extends ModerationResult {
  /** Providers that finished successfully. */
  providers: string[];
  /** Providers that failed or timed out. The result falls back to rule-based output for these. */
  failedProviders: string[];
}

export interface CategoryPolicy {
  action: ModerationAction;
  /** Matches below this confidence are reported with `requiresReview` and not acted on. */
  minConfidence?: number;
  /** Matches below this severity are ignored entirely. */
  minSeverity?: Severity;
}

export type PolicyMap = Partial<Record<ModerationCategory, Partial<CategoryPolicy>>>;

export type MaskStyle = "vowels" | "partial" | "full" | ((matchedText: string) => string);

export interface DictionaryPack {
  language: string;
  /** How words are delimited. `substring` is for scripts written without spaces. */
  boundary?: "word" | "substring";
  rules: ModerationRule[];
  /** Tokens that must never be matched (false-positive handling). */
  allowList?: string[];
}

export interface ProviderMatch {
  start: number;
  end: number;
  category: ModerationCategory;
  confidence: number;
  label?: string;
  severity?: Severity;
  replacement?: string;
}

export interface ConfidenceAdjustment {
  /** Identifies an existing match by rule and start offset. */
  ruleId: string;
  start: number;
  confidence: number;
}

export interface ClassifierInput {
  text: string;
  /** Rule-based matches found before the provider ran. */
  matches: readonly ModerationMatch[];
  language: string;
  signal: AbortSignal;
}

export interface ClassifierOutput {
  matches?: ProviderMatch[];
  adjustments?: ConfidenceAdjustment[];
}

/** Pluggable contextual classifier (local model, app-owned server, or custom callback). */
export interface ContextualClassifier {
  name: string;
  classify(input: ClassifierInput): Promise<ClassifierOutput>;
}

export interface ModerationEvents {
  moderated: ModerationResult;
  violation: ModerationResult;
  blocked: ModerationResult;
  warning: ModerationResult;
  error: { error: unknown; provider?: string };
}

export interface EngineConfig {
  /** Default action applied to every enabled category (see policy defaults). Default "mask". */
  mode?: ModerationAction;
  language?: string;
  /**
   * Built-in packs to load, e.g. `["en"]` to turn off Hinglish. Default for English: `["en", "hi-Latn"]`.
   * Ignored when `packs` is given.
   */
  languages?: string[];
  categories?: ModerationCategory[];
  /** Per-category overrides. */
  policy?: PolicyMap;
  /** Dictionary packs to use. Defaults to the built-in pack for `language`. */
  packs?: DictionaryPack[];
  /** Extra words added as `custom` rules. */
  customWords?: string[];
  /** Words never treated as violations. */
  allowList?: string[];
  rules?: ModerationRule[];
  maskChar?: string;
  maskStyle?: MaskStyle;
  /** Detect `f u c k`-style spaced obfuscation. Default true. */
  detectSpacedLetters?: boolean;
  classifiers?: ContextualClassifier[];
  /** Per-provider timeout for `moderateAsync`. Default 3000ms. */
  classifierTimeoutMs?: number;
  onModerated?: (result: ModerationResult) => void;
  onViolation?: (result: ModerationResult) => void;
  onBlocked?: (result: ModerationResult) => void;
  onWarning?: (result: ModerationResult) => void;
  onError?: (event: ModerationEvents["error"]) => void;
}

export interface ValidationResult {
  valid: boolean;
  result: ModerationResult;
  violations: ModerationMatch[];
}

export interface ModerateAsyncOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface SessionOptions {
  debounceMs?: number;
}

export interface ModerationSession {
  /** Resolves with the result, or `undefined` if a newer call superseded this one. */
  moderate(text: string): Promise<AsyncModerationResult | undefined>;
  cancel(): void;
}
