import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";
import type { ModerationEngine } from "../src";

/*
 * Fuzzing: invariants that must hold for any input. Timing tests (linear time, performance budgets) are in
 * performance.perf.ts, which runs on its own (`pnpm test:perf`) so other tests don't disturb the timings.
 */

const ALL_LANGUAGES = ["en", "hi-Latn", "hi", "es", "fr", "de", "pt"];

/** Small deterministic PRNG (mulberry32), so failures are reproducible from the seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fragments that exercise every stage: dictionary words and phrases, obfuscation, Unicode edge cases.
const FRAGMENTS = [
  "fuck", "fuuuck", "f u c k", "f.u.c.k", "sh1t", "$hit", "ass", "as", "Scunthorpe", "you are an idiot", "kys",
  "\"", "the word", "bhenchod", "teri maa ka", "mierda", "Scheiße", "SCHEISSE", "caralho", "connard", "चूतिया", "लड़",
  "माँ", "ड़", "़", "́", "​", "­", "ｆｕｃｋ", "fuсk", "😀", "👍🏽", "\uD83D", "\uDC00", "*", "**", "f*ck",
  " ", "  ", "\n", "\t", ".", ",", "!", "?", "-", "_", "@", "€", "|", "1", "0", "(", ")", "İ", "ß", "ﬁ", "Ⅻ",
];

function randomText(next: () => number): string {
  const parts: string[] = [];
  const n = Math.floor(next() * 12);
  for (let i = 0; i < n; i++) {
    parts.push(next() < 0.7 ? FRAGMENTS[Math.floor(next() * FRAGMENTS.length)]! : String.fromCharCode(Math.floor(next() * 0x3000)));
  }
  return parts.join(next() < 0.5 ? " " : "");
}

const CONFIGS: [string, ModerationEngine][] = [
  ["default", createModerationEngine()],
  ["all languages", createModerationEngine({ languages: ALL_LANGUAGES })],
  ["suggest", createModerationEngine({ mode: "suggest", languages: ALL_LANGUAGES })],
  ["block", createModerationEngine({ mode: "block" })],
  ["full mask", createModerationEngine({ maskStyle: "full", maskChar: "#", languages: ALL_LANGUAGES })],
  ["partial mask", createModerationEngine({ maskStyle: "partial", languages: ALL_LANGUAGES })],
];

describe.each(CONFIGS)("fuzzing (%s)", (_name, engine) => {
  it("keeps every invariant on 1,500 random inputs", () => {
    const next = rng(0x5afe);
    for (let i = 0; i < 1500; i++) {
      const text = randomText(next);
      const r = engine.moderate(text);
      const context = `input #${i}: ${JSON.stringify(text)}`;

      expect(r.originalText, context).toBe(text);
      expect(r.allowed, context).toBe(r.action !== "block");
      for (const m of r.matches) {
        expect(m.start, context).toBeGreaterThanOrEqual(0);
        expect(m.end, context).toBeLessThanOrEqual(text.length);
        expect(m.start, context).toBeLessThan(m.end);
        expect(m.text, context).toBe(text.slice(m.start, m.end));
        expect(m.confidence, context).toBeGreaterThanOrEqual(0);
        expect(m.confidence, context).toBeLessThanOrEqual(1);
      }
      // Masking is idempotent, and moderating already-moderated text changes nothing.
      const masked = engine.mask(text);
      expect(engine.mask(masked), context).toBe(masked);
      expect(engine.moderate(r.text).text, context).toBe(r.text);
      // Offsets map back inside the original text, monotonically.
      let previous = 0;
      for (let t = 0; t <= r.text.length; t++) {
        const o = r.mapping.toOriginal(t);
        expect(o, context).toBeGreaterThanOrEqual(previous);
        expect(o, context).toBeLessThanOrEqual(text.length);
        previous = o;
      }
      expect(r.mapping.toTransformed(text.length), context).toBe(r.text.length);
    }
  });
});
