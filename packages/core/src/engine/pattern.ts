import { normalizeTerm } from "./normalizer";

export type Run = readonly [char: string, count: number];

export interface PatternAlternative {
  value: string;
  prefix: boolean;
  runs: Run[];
  /** Run characters joined: "fuuck" -> "fuck". Used as the index key. */
  key: string;
}

export interface PatternElement {
  alternatives: PatternAlternative[];
  optional: boolean;
}

export function toRuns(value: string): Run[] {
  const runs: [string, number][] = [];
  for (const c of value) {
    const last = runs[runs.length - 1];
    if (last && last[0] === c) last[1]++;
    else runs.push([c, 1]);
  }
  return runs;
}

export function runsKey(runs: readonly Run[]): string {
  let key = "";
  for (const [c] of runs) key += c;
  return key;
}

/**
 * Repeated-letter tolerant comparison: every run in the token must be at least as long as the
 * corresponding run in the term. "fuuuck" matches "fuck", but "as" does not match "ass".
 */
export function runsMatch(token: readonly Run[], alt: PatternAlternative): boolean {
  const term = alt.runs;
  if (alt.prefix ? token.length < term.length : token.length !== term.length) return false;
  for (let i = 0; i < term.length; i++) {
    const t = token[i]!;
    const p = term[i]!;
    if (t[0] !== p[0] || t[1] < p[1]) return false;
  }
  return true;
}

export class PatternError extends Error {
  override name = "PatternError";
}

function parseAlternative(raw: string, pattern: string): PatternAlternative {
  const prefix = raw.endsWith("*");
  const value = normalizeTerm(prefix ? raw.slice(0, -1) : raw);
  if (!value || /\s/.test(value)) throw new PatternError(`Invalid token "${raw}" in pattern "${pattern}"`);
  const runs = toRuns(value);
  return { value, prefix, runs, key: runsKey(runs) };
}

export function parsePattern(pattern: string): PatternElement[] {
  const parts = pattern.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new PatternError("Pattern must not be empty");
  return parts.map((part, index) => {
    let body = part;
    const optional = body.endsWith("?");
    if (optional) body = body.slice(0, -1);
    if (optional && index === 0) throw new PatternError(`First token cannot be optional in "${pattern}"`);
    if (body.startsWith("(")) {
      if (!body.endsWith(")")) throw new PatternError(`Unclosed group "${part}" in "${pattern}"`);
      body = body.slice(1, -1);
    }
    const alternatives = body.split("|").map((alt) => parseAlternative(alt, pattern));
    return { alternatives, optional };
  });
}
