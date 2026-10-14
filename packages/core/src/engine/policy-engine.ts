import {
  ACTION_SEVERITY,
  ALL_CATEGORIES,
  SEVERITY_RANK,
  type CategoryPolicy,
  type ModerationAction,
  type ModerationCategory,
  type PolicyMap,
  type Severity,
} from "@safetype/shared";

export interface ResolvedPolicy {
  enabled: boolean;
  action: ModerationAction;
  minConfidence: number;
  minSeverity: Severity;
}

export type ResolvedPolicies = Record<ModerationCategory, ResolvedPolicy>;

const ACTIONS = new Set<ModerationAction>(["allow", "mask", "suggest", "warn", "block"]);

export function assertAction(action: unknown): asserts action is ModerationAction {
  if (!ACTIONS.has(action as ModerationAction)) throw new TypeError(`Unknown moderation action "${String(action)}"`);
}

/**
 * Builds per-category defaults from the global mode.
 * Harassment is phrase-level and context-dependent, so masking it makes little sense:
 * in "mask" mode it defaults to "warn". Low-severity profanity ("damn") is ignored by default.
 */
export function defaultPolicies(mode: ModerationAction, categories: readonly ModerationCategory[]): ResolvedPolicies {
  const enabled = new Set(categories);
  const make = (category: ModerationCategory, policy: Omit<ResolvedPolicy, "enabled">): ResolvedPolicy => ({
    enabled: enabled.has(category),
    ...policy,
  });
  return {
    profanity: make("profanity", { action: mode, minConfidence: 0, minSeverity: "medium" }),
    custom: make("custom", { action: mode, minConfidence: 0, minSeverity: "low" }),
    hate: make("hate", { action: mode, minConfidence: 0.6, minSeverity: "low" }),
    harassment: make("harassment", { action: mode === "mask" ? "warn" : mode, minConfidence: 0.6, minSeverity: "low" }),
  };
}

export function applyPolicyOverrides(base: ResolvedPolicies, overrides: PolicyMap | undefined): ResolvedPolicies {
  const next = { ...base };
  if (!overrides) return next;
  for (const category of ALL_CATEGORIES) {
    const o: Partial<CategoryPolicy> | undefined = overrides[category];
    if (!o) continue;
    if (o.action !== undefined) assertAction(o.action);
    if (o.minConfidence !== undefined && !(o.minConfidence >= 0 && o.minConfidence <= 1)) {
      throw new RangeError(`minConfidence for "${category}" must be within [0, 1]`);
    }
    if (o.minSeverity !== undefined && !(o.minSeverity in SEVERITY_RANK)) {
      throw new TypeError(`Unknown severity "${String(o.minSeverity)}"`);
    }
    next[category] = { ...next[category], ...stripUndefined(o) };
  }
  return next;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export interface PolicyDecision {
  /** False when the match should be dropped entirely (disabled category or below min severity). */
  keep: boolean;
  action: ModerationAction;
  requiresReview: boolean;
}

export function decide(policy: ResolvedPolicy, severity: Severity, confidence: number): PolicyDecision {
  if (!policy.enabled || SEVERITY_RANK[severity] < SEVERITY_RANK[policy.minSeverity]) {
    return { keep: false, action: "allow", requiresReview: false };
  }
  if (confidence < policy.minConfidence) return { keep: true, action: "allow", requiresReview: true };
  return { keep: true, action: policy.action, requiresReview: false };
}

export function mostRestrictive(actions: Iterable<ModerationAction>): ModerationAction {
  let result: ModerationAction = "allow";
  for (const action of actions) if (ACTION_SEVERITY[action] > ACTION_SEVERITY[result]) result = action;
  return result;
}
