import { applyLeet, type NormalizedText } from "./normalizer";

export interface Token {
  /** Offsets in the original text. */
  start: number;
  end: number;
  /** Offsets in the normalized text. */
  nStart: number;
  nEnd: number;
  /** Normalized, leet-mapped value used for matching. */
  value: string;
  /** Token contains the mask character, i.e. it was already masked. Never matched (idempotency). */
  masked: boolean;
  /** For merged spaced-letter tokens: index of the first underlying token. */
  firstIndex: number;
}

const EDGE_TRIM = new Set(["*", "!", "|"]);
const SPACED_SEPARATORS = new Set([" ", ".", "-", "_"]);
const regexCache = new Map<string, RegExp>();

function tokenRegex(maskChar: string): RegExp {
  let re = regexCache.get(maskChar);
  if (!re) {
    const escaped = maskChar.replace(/[\\\]^-]/g, "\\$&");
    re = new RegExp(`[\\p{L}\\p{N}@$!|*€${escaped}]+`, "gu");
    regexCache.set(maskChar, re);
  }
  return re;
}

export function tokenize(normalized: NormalizedText, maskChar = "*"): Token[] {
  const { text, starts, ends } = normalized;
  const tokens: Token[] = [];
  const re = tokenRegex(maskChar);
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    let nStart = m.index;
    let nEnd = m.index + m[0].length;
    // Trim emphasis/punctuation at the edges ("*word*", "word!") without touching inner obfuscation.
    while (nStart < nEnd && EDGE_TRIM.has(text[nStart]!)) nStart++;
    while (nEnd > nStart && EDGE_TRIM.has(text[nEnd - 1]!)) nEnd--;
    if (nStart === nEnd) continue;
    const raw = text.slice(nStart, nEnd);
    tokens.push({
      start: starts[nStart]!,
      end: ends[nEnd - 1]!,
      nStart,
      nEnd,
      value: applyLeet(raw),
      masked: raw.includes(maskChar),
      firstIndex: tokens.length,
    });
  }
  return tokens;
}

/**
 * Merges runs of 3+ single-character tokens separated by one separator char ("f u c k", "f.u.c.k")
 * into virtual tokens. These are only checked against single-word rules.
 */
export function mergeSpacedLetters(tokens: readonly Token[], normalizedText: string): Token[] {
  const merged: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    let j = i;
    while (
      j + 1 < tokens.length &&
      tokens[j]!.value.length === 1 &&
      tokens[j + 1]!.value.length === 1 &&
      tokens[j + 1]!.nStart - tokens[j]!.nEnd === 1 &&
      SPACED_SEPARATORS.has(normalizedText[tokens[j]!.nEnd]!)
    ) {
      j++;
    }
    if (j - i + 1 >= 3) {
      const run = tokens.slice(i, j + 1);
      merged.push({
        start: run[0]!.start,
        end: run[run.length - 1]!.end,
        nStart: run[0]!.nStart,
        nEnd: run[run.length - 1]!.nEnd,
        value: run.map((t) => t.value).join(""),
        masked: run.some((t) => t.masked),
        firstIndex: i,
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return merged;
}
