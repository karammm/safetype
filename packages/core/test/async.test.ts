import { describe, expect, it, vi } from "vitest";
import { createModerationEngine, type ContextualClassifier } from "../src";

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

describe("moderateAsync", () => {
  it("returns rule-based results when no classifiers are configured", async () => {
    const r = await createModerationEngine().moderateAsync("shit");
    expect(r.text).toBe("sh*t");
    expect(r.providers).toEqual([]);
  });

  it("merges provider matches and confidence adjustments", async () => {
    const provider: ContextualClassifier = {
      name: "ctx",
      async classify({ text, matches }) {
        const insult = matches.find((m) => m.ruleId === "en.harassment.insult");
        return {
          matches: [{ start: text.indexOf("people like"), end: text.length, category: "hate", confidence: 0.92, label: "group-slur" }],
          adjustments: insult ? [{ ruleId: insult.ruleId, start: insult.start, confidence: 0.1 }] : [],
        };
      },
    };
    const e = createModerationEngine({ classifiers: [provider] });
    const r = await e.moderateAsync("you are an idiot, people like that are vermin");
    const insult = r.matches.find((m) => m.ruleId === "en.harassment.insult")!;
    expect(insult).toMatchObject({ confidence: 0.1, requiresReview: true, action: "allow" });
    const hate = r.matches.find((m) => m.source === "ctx")!;
    expect(hate).toMatchObject({ category: "hate", ruleId: "ctx:group-slur", confidence: 0.92, action: "warn" });
    expect(r.providers).toEqual(["ctx"]);
  });

  it("warns instead of masking multi-word hate/harassment findings from providers", async () => {
    const provider: ContextualClassifier = {
      name: "ctx",
      classify: async ({ text }) => ({
        matches: [
          { start: 0, end: text.indexOf(","), category: "hate", confidence: 0.9 },
          { start: text.indexOf("scum"), end: text.indexOf("scum") + 4, category: "harassment", confidence: 0.9 },
        ],
      }),
    };
    const r = await createModerationEngine({ classifiers: [provider] }).moderateAsync("you people are vermin, scum");
    expect(r.matches.map((m) => [m.text, m.action])).toEqual([
      ["you people are vermin", "warn"],
      ["scum", "warn"],
    ]);
    expect(r.text).toBe("you people are vermin, scum");
  });

  it("ignores invalid provider ranges and categories", async () => {
    const provider: ContextualClassifier = {
      name: "bad",
      classify: async () => ({
        matches: [
          { start: -1, end: 3, category: "hate", confidence: 1 },
          { start: 0, end: 999, category: "hate", confidence: 1 },
          { start: 2, end: 2, category: "hate", confidence: 1 },
          { start: 0, end: 2, category: "spam" as never, confidence: 1 },
        ],
      }),
    };
    const r = await createModerationEngine({ classifiers: [provider] }).moderateAsync("hello");
    expect(r.matches).toEqual([]);
  });

  it("falls back to rule-based results when a provider fails", async () => {
    const onError = vi.fn();
    const failing: ContextualClassifier = { name: "down", classify: async () => Promise.reject(new Error("503")) };
    const e = createModerationEngine({ classifiers: [failing], onError });
    const r = await e.moderateAsync("shit");
    expect(r.text).toBe("sh*t");
    expect(r.failedProviders).toEqual(["down"]);
    expect(onError).toHaveBeenCalledWith({ error: expect.objectContaining({ message: "503" }), provider: "down" });
  });

  it("handles providers that throw synchronously", async () => {
    const thrower: ContextualClassifier = {
      name: "sync",
      classify: () => {
        throw new Error("sync boom");
      },
    };
    const r = await createModerationEngine({ classifiers: [thrower] }).moderateAsync("ok");
    expect(r.failedProviders).toEqual(["sync"]);
  });

  it("times out slow providers and aborts their signal", async () => {
    let providerSignal: AbortSignal | undefined;
    const slow: ContextualClassifier = {
      name: "slow",
      async classify({ signal }) {
        providerSignal = signal;
        await delay(1000, signal);
        return {};
      },
    };
    const onError = vi.fn();
    const r = await createModerationEngine({ classifiers: [slow], onError }).moderateAsync("ok", { timeoutMs: 20 });
    expect(r.failedProviders).toEqual(["slow"]);
    expect(providerSignal?.aborted).toBe(true);
    expect(onError.mock.calls[0]![0].error.name).toBe("TimeoutError");
  });

  it("rejects with AbortError and does not emit when cancelled", async () => {
    const onModerated = vi.fn();
    const slow: ContextualClassifier = { name: "slow", classify: async ({ signal }) => (await delay(200, signal), {}) };
    const e = createModerationEngine({ classifiers: [slow], onModerated });
    const controller = new AbortController();
    const pending = e.moderateAsync("hello", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(onModerated).not.toHaveBeenCalled();
  });

  it("rejects immediately for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createModerationEngine().moderateAsync("x", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("sessions (stale-result protection)", () => {
  it("resolves superseded calls with undefined and only returns the latest", async () => {
    const seen: string[] = [];
    const provider: ContextualClassifier = {
      name: "p",
      async classify({ text, signal }) {
        await delay(text === "first" ? 50 : 5, signal);
        seen.push(text);
        return {};
      },
    };
    const session = createModerationEngine({ classifiers: [provider] }).createSession();
    const first = session.moderate("first");
    const second = session.moderate("second");
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toMatchObject({ originalText: "second" });
    expect(seen).toEqual(["second"]);
  });

  it("debounces rapid typing into a single run", async () => {
    const classify = vi.fn(async () => ({}));
    const session = createModerationEngine({ classifiers: [{ name: "p", classify }] }).createSession({ debounceMs: 20 });
    const calls = ["s", "sh", "shi", "shit"].map((t) => session.moderate(t));
    const results = await Promise.all(calls);
    expect(results.slice(0, 3)).toEqual([undefined, undefined, undefined]);
    expect(results[3]).toMatchObject({ text: "sh*t" });
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("cancel() resolves the pending call with undefined", async () => {
    const session = createModerationEngine().createSession({ debounceMs: 50 });
    const pending = session.moderate("shit");
    session.cancel();
    await expect(pending).resolves.toBeUndefined();
  });
});
