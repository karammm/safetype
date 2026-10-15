import type { MaskStyle, OffsetMapping, TextEdit } from "@safetype/shared";
import { LEET, normalizeChar } from "./normalizer";

const WORD_CHAR = new RegExp("[\\p{L}\\p{N}@$!|\u20AC]", "u");
const MARK = /\p{M}/u;
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** Splits text into a base character plus its combining marks ("चू", "ति", "या"), so a mask never leaves a stray vowel sign. */
function clusters(text: string): string[] {
  const out: string[] = [];
  for (const c of text) {
    if (MARK.test(c) && out.length > 0) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

/**
 * Masks matched text. Only word characters are replaced, so separators in "f u c k" survive.
 * A character together with its combining marks is masked as one unit ("चूतिया" -> "चू*या").
 *  - vowels:  keep the first character, mask vowels  ("fuck" -> "f*ck"); falls back to `partial`
 *  - partial: keep the first and last character      ("twat" -> "t**t")
 *  - full:    mask every word character              ("fuck" -> "****")
 */
export function maskText(text: string, style: MaskStyle = "vowels", maskChar = "*"): string {
  if (typeof style === "function") return style(text);
  const units = clusters(text);
  const wordPositions = units.map((u, i) => (isWordChar(Array.from(u)[0]!) ? i : -1)).filter((i) => i >= 0);
  if (wordPositions.length === 0) return text;
  const out = units.slice();
  const first = wordPositions[0]!;
  const last = wordPositions[wordPositions.length - 1]!;

  if (style === "full") {
    for (const i of wordPositions) out[i] = maskChar;
    return out.join("");
  }

  if (style === "vowels") {
    let masked = 0;
    for (const i of wordPositions) {
      if (i === first) continue;
      const n = normalizeChar(Array.from(units[i]!)[0]!);
      if (VOWELS.has(LEET[n] ?? n)) {
        out[i] = maskChar;
        masked++;
      }
    }
    if (masked > 0) return out.join("");
  }

  // partial
  for (const i of wordPositions) {
    if (i === first) continue;
    if (i === last && wordPositions.length > 2) continue;
    out[i] = maskChar;
  }
  return out.join("");
}

/** Applies the casing of `source` ("FUCK" / "Fuck" / "fuck") to `replacement`. */
export function matchCase(source: string, replacement: string): string {
  const letters = source.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return replacement.toUpperCase();
  }
  const firstLetter = letters[0];
  if (firstLetter && firstLetter !== firstLetter.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export interface TransformOutput {
  text: string;
  mapping: OffsetMapping;
}

/** Applies non-overlapping edits and returns a bidirectional offset mapping. */
export function applyEdits(text: string, edits: readonly TextEdit[]): TransformOutput {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start < sorted[i - 1]!.end) throw new RangeError("Edits must not overlap");
  }
  let out = "";
  let cursor = 0;
  for (const edit of sorted) {
    out += text.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  out += text.slice(cursor);
  return { text: out, mapping: createOffsetMapping(sorted, text.length, out.length) };
}

export function createOffsetMapping(edits: readonly TextEdit[], originalLength: number, transformedLength: number): OffsetMapping {
  const frozen = Object.freeze(edits.map((e) => Object.freeze({ ...e })));
  const clamp = (n: number, max: number) => Math.min(Math.max(0, Math.trunc(n)), max);
  return {
    edits: frozen,
    toTransformed(offset) {
      const o = clamp(offset, originalLength);
      let delta = 0;
      for (const e of frozen) {
        if (o <= e.start) return o + delta;
        if (o < e.end) return e.start + delta + Math.min(o - e.start, e.replacement.length);
        delta += e.replacement.length - (e.end - e.start);
      }
      return o + delta;
    },
    toOriginal(offset) {
      const t = clamp(offset, transformedLength);
      let delta = 0;
      for (const e of frozen) {
        const newStart = e.start + delta;
        const newEnd = newStart + e.replacement.length;
        if (t <= newStart) return t - delta;
        if (t < newEnd) return e.start + Math.min(t - newStart, e.end - e.start);
        delta += e.replacement.length - (e.end - e.start);
      }
      return t - delta;
    },
  };
}
