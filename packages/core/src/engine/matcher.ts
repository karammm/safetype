import type { ModerationCategory, ModerationRule, Severity } from "@safetype/shared";
import type { NormalizedText } from "./normalizer";
import { parsePattern, PatternError, runsMatch, toRuns, type PatternAlternative, type PatternElement, type Run } from "./pattern";
import type { Token } from "./tokenizer";

export const DEFAULT_PRIORITY: Readonly<Record<ModerationCategory, number>> = {
  custom: 40,
  hate: 30,
  harassment: 20,
  profanity: 10,
};

export interface CompiledRule {
  id: string;
  category: ModerationCategory;
  severity: Severity;
  confidence: number;
  priority: number;
  replacement?: string;
  label?: string;
  boundary: "word" | "substring";
  elements: PatternElement[];
}

export interface RawMatch {
  start: number;
  end: number;
  rule: CompiledRule;
  confidence: number;
  /** Index of the first primary token covered, when matched on word boundaries. */
  tokenIndex?: number;
  source?: string;
}

const CATEGORIES = new Set<ModerationCategory>(["profanity", "hate", "harassment", "custom"]);
const SEVERITIES = new Set<Severity>(["low", "medium", "high", "critical"]);

export function compileRule(rule: ModerationRule, boundary: "word" | "substring" = "word"): CompiledRule {
  if (!rule || typeof rule.id !== "string" || rule.id.length === 0) throw new TypeError("Rule requires a non-empty id");
  if (typeof rule.pattern !== "string") throw new TypeError(`Rule "${rule.id}" requires a pattern`);
  if (!CATEGORIES.has(rule.category)) throw new TypeError(`Rule "${rule.id}" has unknown category "${String(rule.category)}"`);
  if (rule.severity !== undefined && !SEVERITIES.has(rule.severity)) {
    throw new TypeError(`Rule "${rule.id}" has unknown severity "${String(rule.severity)}"`);
  }
  const confidence = rule.confidence ?? 1;
  if (!(confidence >= 0 && confidence <= 1)) throw new RangeError(`Rule "${rule.id}" confidence must be within [0, 1]`);
  let elements: PatternElement[];
  try {
    elements = parsePattern(rule.pattern);
  } catch (error) {
    if (error instanceof PatternError) throw new PatternError(`Rule "${rule.id}": ${error.message}`);
    throw error;
  }
  if (boundary === "substring" && elements.length !== 1) {
    throw new PatternError(`Rule "${rule.id}": substring packs support single-token patterns only`);
  }
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity ?? "medium",
    confidence,
    priority: rule.priority ?? DEFAULT_PRIORITY[rule.category],
    replacement: rule.replacement,
    label: rule.label,
    boundary,
    elements,
  };
}

interface IndexEntry {
  rule: CompiledRule;
  alt: PatternAlternative;
}

/** Rule index keyed by the first pattern token, for O(tokens) candidate lookup. */
export class RuleIndex {
  private readonly exact = new Map<string, IndexEntry[]>();
  private readonly prefix = new Map<string, IndexEntry[]>();
  private readonly substring: CompiledRule[] = [];

  constructor(rules: Iterable<CompiledRule>) {
    for (const rule of rules) {
      if (rule.boundary === "substring") {
        this.substring.push(rule);
        continue;
      }
      for (const alt of rule.elements[0]!.alternatives) {
        const map = alt.prefix ? this.prefix : this.exact;
        const key = alt.prefix ? alt.key[0]! : alt.key;
        const list = map.get(key);
        if (list) list.push({ rule, alt });
        else map.set(key, [{ rule, alt }]);
      }
    }
  }

  candidates(runs: readonly Run[], key: string): IndexEntry[] {
    const out: IndexEntry[] = [];
    for (const entry of this.exact.get(key) ?? []) if (runsMatch(runs, entry.alt)) out.push(entry);
    for (const entry of this.prefix.get(key[0] ?? "") ?? []) if (runsMatch(runs, entry.alt)) out.push(entry);
    return out;
  }

  get substringRules(): readonly CompiledRule[] {
    return this.substring;
  }
}

interface TokenInfo {
  runs: Run[];
  key: string;
  blocked: boolean;
}

function tokenInfo(token: Token, allowList: ReadonlySet<string>): TokenInfo {
  const runs = toRuns(token.value);
  let key = "";
  for (const [c] of runs) key += c;
  return { runs, key, blocked: token.masked || allowList.has(token.value) };
}

function elementMatches(element: PatternElement, info: TokenInfo): boolean {
  if (info.blocked) return false;
  return element.alternatives.some((alt) => runsMatch(info.runs, alt));
}

/** Returns the index of the last token consumed, preferring the longest match, or -1. */
function matchRest(elements: readonly PatternElement[], e: number, infos: readonly TokenInfo[], t: number): number {
  if (e === elements.length) return t - 1;
  const element = elements[e]!;
  let best = -1;
  if (t < infos.length && elementMatches(element, infos[t]!)) {
    best = matchRest(elements, e + 1, infos, t + 1);
  }
  if (element.optional) {
    best = Math.max(best, matchRest(elements, e + 1, infos, t));
  }
  return best;
}

export interface MatchInput {
  normalized: NormalizedText;
  tokens: readonly Token[];
  spaced: readonly Token[];
  allowList: ReadonlySet<string>;
}

export function findMatches(index: RuleIndex, input: MatchInput): RawMatch[] {
  const { tokens, spaced, allowList, normalized } = input;
  const infos = tokens.map((t) => tokenInfo(t, allowList));
  const out: RawMatch[] = [];
  const seen = new Set<string>();
  const push = (m: RawMatch) => {
    const k = `${m.rule.id}:${m.start}:${m.end}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };

  for (let i = 0; i < tokens.length; i++) {
    const info = infos[i]!;
    if (info.blocked) continue;
    const seenRules = new Set<string>();
    for (const { rule } of index.candidates(info.runs, info.key)) {
      if (seenRules.has(rule.id)) continue;
      seenRules.add(rule.id);
      const last = matchRest(rule.elements, 1, infos, i + 1);
      if (last < i) continue;
      push({ start: tokens[i]!.start, end: tokens[last]!.end, rule, confidence: rule.confidence, tokenIndex: i });
    }
  }

  for (const token of spaced) {
    const info = tokenInfo(token, allowList);
    if (info.blocked) continue;
    for (const { rule } of index.candidates(info.runs, info.key)) {
      if (rule.elements.length !== 1) continue;
      push({ start: token.start, end: token.end, rule, confidence: rule.confidence, tokenIndex: token.firstIndex });
    }
  }

  const text = normalized.text;
  for (const rule of index.substringRules) {
    for (const alt of rule.elements[0]!.alternatives) {
      for (let at = text.indexOf(alt.value); at !== -1; at = text.indexOf(alt.value, at + 1)) {
        const nEnd = at + alt.value.length;
        push({ start: normalized.starts[at]!, end: normalized.ends[nEnd - 1]!, rule, confidence: rule.confidence });
      }
    }
  }

  return out;
}
