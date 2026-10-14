/**
 * Unicode-aware normalization with an offset map back to the original text.
 *
 * Every UTF-16 unit of the normalized string records the [start, end) range of the original
 * code point it came from, so matches found in normalized text map back to exact original offsets.
 */

const ZERO_WIDTH = new RegExp("^[\u200B-\u200D\u2060\uFEFF\u00AD\u180E]$");
const COMBINING_MARKS = /\p{M}/gu;

/** Cyrillic and Greek letters that are visually identical to Latin letters (lowercase forms). */
const CONFUSABLES: Readonly<Record<string, string>> = {
  // Cyrillic
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t",
  у: "y", х: "x", ѕ: "s", і: "i", ї: "i", ј: "j", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w", ү: "y",
  // Greek
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u",
  χ: "x", ω: "w",
};

/** Symbol/digit substitutions applied only inside tokens that already contain a letter. */
export const LEET: Readonly<Record<string, string>> = {
  "@": "a",
  "4": "a",
  $: "s",
  "5": "s",
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "€": "e",
  "7": "t",
};

const charCache = new Map<string, string>();

/** Normalizes a single code point: drops zero-width chars, strips diacritics, lowercases, maps lookalikes. */
export function normalizeChar(ch: string): string {
  const cached = charCache.get(ch);
  if (cached !== undefined) return cached;
  let out: string;
  if (ZERO_WIDTH.test(ch)) {
    out = "";
  } else {
    const base = ch.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
    out = "";
    for (const c of base) out += CONFUSABLES[c] ?? c;
  }
  if (charCache.size < 10_000) charCache.set(ch, out);
  return out;
}

export interface NormalizedText {
  text: string;
  /** Original start offset for each UTF-16 unit of `text`. */
  starts: number[];
  /** Original end offset (exclusive) for each UTF-16 unit of `text`. */
  ends: number[];
}

export function normalize(input: string): NormalizedText {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  while (i < input.length) {
    const cp = input.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const end = i + ch.length;
    const n = normalizeChar(ch);
    for (let k = 0; k < n.length; k++) {
      starts.push(i);
      ends.push(end);
    }
    text += n;
    i = end;
  }
  return { text, starts, ends };
}

/** Normalizes a dictionary value so it compares equal to normalized, leet-mapped tokens. */
export function normalizeTerm(value: string): string {
  return applyLeet(normalize(value).text);
}

const HAS_LETTER = /\p{L}/u;

export function applyLeet(value: string): string {
  if (!HAS_LETTER.test(value)) return value;
  let out = "";
  for (const c of value) out += LEET[c] ?? c;
  return out;
}
