import type { MatchContext } from "@safetype/shared";
import type { RawMatch } from "./matcher";
import type { Token } from "./tokenizer";

/**
 * Lightweight, synchronous context heuristics. They only *lower* confidence; they never raise it.
 * Quoted or mentioned text ("the word X", "he called me X") is more often reported speech or
 * discussion than abuse. Deeper context needs an async ContextualClassifier.
 */

export const CONTEXT_FACTOR: Readonly<Record<MatchContext, number>> = {
  direct: 1,
  quoted: 0.5,
  mention: 0.4,
};

const MENTION_WORDS = new Set([
  "word", "words", "term", "slur", "phrase", "say", "said", "saying", "says", "spell", "spelled",
  "called", "calling", "means", "meaning", "define", "definition", "using", "use",
]);

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["“", "”"],
  ["‘", "’"],
  ["«", "»"],
  ["「", "」"],
];

/** Finds [start, end) ranges enclosed by quotes, never spanning a line break. */
export function findQuotedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const [open, close] of PAIRS) {
    let from = 0;
    while (from < text.length) {
      const s = text.indexOf(open, from);
      if (s === -1) break;
      const e = text.indexOf(close, s + 1);
      if (e === -1) break;
      const newline = text.indexOf("\n", s);
      if (newline !== -1 && newline < e) {
        from = newline + 1;
        continue;
      }
      ranges.push([s + 1, e]);
      from = e + 1;
    }
  }
  return ranges;
}

export function detectContext(match: RawMatch, tokens: readonly Token[], quoted: ReadonlyArray<[number, number]>): MatchContext {
  if (match.tokenIndex !== undefined) {
    for (let k = 1; k <= 2; k++) {
      const prev = tokens[match.tokenIndex - k];
      if (prev && MENTION_WORDS.has(prev.value)) return "mention";
    }
  }
  for (const [s, e] of quoted) if (match.start >= s && match.end <= e) return "quoted";
  return "direct";
}
