import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

/*
 * Linear time on adversarial input (no ReDoS-style blow-ups) and performance budgets.
 * Run alone with `pnpm test:perf` (CI runs it as a separate step), so other test files don't compete for the CPU.
 * Budgets are about 10x what a laptop measures, with 3x more headroom on shared CI runners.
 */

const SLACK = process.env.CI ? 3 : 1;
const ALL_LANGUAGES = ["en", "hi-Latn", "hi", "es", "fr", "de", "pt"];

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
