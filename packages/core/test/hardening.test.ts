import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";
import type { ModerationEngine } from "../src";

/*
 * Hardening: invariants under random input (fuzzing), linear time on adversarial input (no ReDoS-style
 * blow-ups), and performance budgets. Budgets are about 10x what a laptop measures, with 3x more on shared
 * CI runners, where test files run in parallel on a few CPUs.
 */

const SLACK = process.env.CI ? 3 : 1;

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

/** Fastest of a few runs, in milliseconds: the algorithm's cost, with as little machine noise as possible. */
function time(fn: () => void, runs = 5): number {
  fn(); // warm up
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

const ADVERSARIAL: [string, (n: number) => string][] = [
  ["one huge token", (n) => "f".repeat(n)],
  ["repeating prefix", (n) => "fu".repeat(n)],
  ["spaced letters", (n) => "f u ".repeat(n)],
  ["phrase starts", (n) => "you are ".repeat(n)],
  ["family-insult starts", (n) => "teri maa ".repeat(n)],
  ["dot-separated letters", (n) => "a.".repeat(n)],
  ["stacked combining marks", (n) => "a" + "́".repeat(n)],
  ["Devanagari clusters", (n) => "चू".repeat(n)],
  ["zero-width between letters", (n) => "f​".repeat(n)],
  ["leet", (n) => "$h1".repeat(n)],
  ["masked text", (n) => "f*ck ".repeat(n)],
];

describe("no super-linear behaviour on adversarial input", () => {
  const engine = createModerationEngine({ languages: ALL_LANGUAGES });

  it.each(ADVERSARIAL)("%s", (_name, generate) => {
    const small = time(() => engine.moderate(generate(1_000)));
    const large = time(() => engine.moderate(generate(16_000)));
    // 16x the input: linear code takes about 16x as long, quadratic about 256x. The 64x threshold separates
    // the two even when a busy machine adds garbage-collection noise. Timings under 2 ms count as 2 ms.
    expect(large).toBeLessThan(Math.max(small, 2) * 64);
    expect(large).toBeLessThan(500 * SLACK);
  });
});

describe("performance budgets", () => {
  const sentence = "The quick brown fox jumps over the lazy dog. What the fuck are you doing? you are such an idiot. ";

  it("moderates 100 KB of text in under 250 ms", () => {
    const engine = createModerationEngine({ languages: ALL_LANGUAGES });
    const text = sentence.repeat(Math.ceil(100_000 / sentence.length)).slice(0, 100_000);
    expect(time(() => engine.moderate(text))).toBeLessThan(250 * SLACK);
  });

  it("moderates 1,000 chat messages in under 150 ms", () => {
    const engine = createModerationEngine();
    const messages = Array.from({ length: 1000 }, (_, i) => `message ${i}: this is shit and you are a loser`);
    expect(time(() => messages.forEach((m) => engine.moderate(m)))).toBeLessThan(150 * SLACK);
  });

  it("re-checks a 5,000-character document per keystroke in under 5 ms on average", () => {
    const engine = createModerationEngine();
    const doc = sentence.repeat(60).slice(0, 5000);
    const perKeystroke = time(() => {
      for (let i = 0; i < 50; i++) engine.moderate(doc + "x".repeat(i % 10));
    }) / 50;
    expect(perKeystroke).toBeLessThan(5 * SLACK);
  });

  it("creates an engine with every language in under 50 ms", () => {
    expect(time(() => createModerationEngine({ languages: ALL_LANGUAGES }))).toBeLessThan(50 * SLACK);
  });
});
