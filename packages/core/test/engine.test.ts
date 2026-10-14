import { describe, expect, it, vi } from "vitest";
import { createModerationEngine } from "../src";

const engine = createModerationEngine({ mode: "mask" });
const masked = (text: string) => engine.moderate(text).text;

describe("profanity masking", () => {
  it("masks the reference example", () => {
    const result = engine.moderate("What the fuck are you doing?");
    expect(result.text).toBe("What the f*ck are you doing?");
    expect(result.action).toBe("mask");
    expect(result.allowed).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      start: 9,
      end: 13,
      text: "fuck",
      category: "profanity",
      ruleId: "en.profanity.fuck",
      action: "mask",
      applied: true,
      context: "direct",
    });
  });

  it("is case-insensitive and preserves original casing", () => {
    expect(masked("FUCK")).toBe("F*CK");
    expect(masked("Fuck off")).toBe("F*ck off");
  });

  it("matches word forms via prefix rules", () => {
    expect(masked("fucking fucker motherfucker")).toBe("f*ck*ng f*ck*r m*th*rf*ck*r");
    expect(masked("bullshit")).toBe("b*llsh*t");
  });

  it("masks multiple matches", () => {
    const result = engine.moderate("shit, this bitch is an asshole");
    expect(result.text).toBe("sh*t, this b*tch is an *ssh*l*".replace("*ssh*l*", "assh*l*"));
    expect(result.matches.map((m) => m.ruleId)).toEqual([
      "en.profanity.shit",
      "en.profanity.bitch",
      "en.profanity.asshole",
    ]);
  });

  it("leaves clean text untouched", () => {
    const result = engine.moderate("Have a lovely day!");
    expect(result.text).toBe("Have a lovely day!");
    expect(result.matches).toEqual([]);
    expect(result.action).toBe("allow");
  });
});

describe("word boundaries and false positives", () => {
  it.each([
    "Scunthorpe",
    "the class assassin",
    "as a matter of fact",
    "pass the bass",
    "cocktail hour",
    "shiitake mushrooms",
    "Dickens wrote novels",
    "assess the situation",
  ])("does not flag %s", (text) => {
    expect(engine.moderate(text).matches).toEqual([]);
  });

  it("ignores low severity words by default but can enable them", () => {
    expect(engine.moderate("damn it").matches).toEqual([]);
    const strict = createModerationEngine({ policy: { profanity: { minSeverity: "low" } } });
    expect(strict.moderate("damn it").text).toBe("d*mn it");
  });

  it("honours a user allow list", () => {
    const custom = createModerationEngine({ allowList: ["bastard"] });
    expect(custom.moderate("you bastard").matches).toEqual([]);
  });
});

describe("normalization and obfuscation", () => {
  it.each([
    ["FUUUUCK", "F****CK"],
    ["sh1t", "sh*t"],
    ["$hit", "$h*t"],
    ["f u c k", "f * c k"],
    ["f.u.c.k", "f.*.c.k"],
    ["fück", "f*ck"],
    ["ｆｕｃｋ", "ｆ*ｃｋ"],
    ["fuсk", "f*сk"], // Cyrillic "с"
    ["fu​ck", "f*​ck"], // zero-width space
    ["*fuck*", "*f*ck*"],
    ["fuck!", "f*ck!"],
  ])("masks %j", (input, expected) => {
    expect(masked(input)).toBe(expected);
  });

  it("does not treat digits as letters in plain numbers", () => {
    expect(engine.moderate("I owe you $5 and 1000 points").matches).toEqual([]);
  });

  it("does not merge ordinary single-letter words", () => {
    expect(engine.moderate("I am a b c d").matches).toEqual([]);
  });

  it("can disable spaced-letter detection", () => {
    const e = createModerationEngine({ detectSpacedLetters: false });
    expect(e.moderate("f u c k").matches).toEqual([]);
  });

  it("maps offsets back to the original text with surrogate pairs and NFKD expansions", () => {
    const text = "😀 ﬁne ｆｕｃｋ";
    const result = engine.moderate(text);
    const m = result.matches[0]!;
    expect(text.slice(m.start, m.end)).toBe("ｆｕｃｋ");
  });
});

describe("idempotency", () => {
  it.each(["What the fuck", "f u c k", "FUUUCK sh1t", "you fucking idiot", "bullshit and bitches"])(
    "mask(mask(%j)) === mask(%j)",
    (text) => {
      const once = engine.mask(text);
      expect(engine.mask(once)).toBe(once);
      expect(engine.moderate(once).matches.filter((m) => m.category === "profanity")).toEqual([]);
    },
  );

  it("supports a custom mask character without re-masking", () => {
    const e = createModerationEngine({ maskChar: "#" });
    const once = e.moderate("fuck").text;
    expect(once).toBe("f#ck");
    expect(e.moderate(once).matches).toEqual([]);
  });

  it("rejects invalid mask characters", () => {
    expect(() => createModerationEngine({ maskChar: "ab" })).toThrow(TypeError);
    expect(() => createModerationEngine({ maskChar: "x" })).toThrow(TypeError);
  });
});

describe("mask styles", () => {
  it("supports partial, full and custom styles", () => {
    expect(createModerationEngine({ maskStyle: "partial" }).moderate("fuck").text).toBe("f**k");
    expect(createModerationEngine({ maskStyle: "full" }).moderate("fuck").text).toBe("****");
    expect(createModerationEngine({ maskStyle: () => "[removed]" }).moderate("oh fuck").text).toBe("oh [removed]");
  });
});

describe("modes", () => {
  const text = "What the fuck are you doing?";

  it("allow reports matches without acting", () => {
    const r = createModerationEngine({ mode: "allow" }).moderate(text);
    expect(r.text).toBe(text);
    expect(r.action).toBe("allow");
    expect(r.matches).toHaveLength(1);
  });

  it("warn leaves text unchanged and stays allowed", () => {
    const r = createModerationEngine({ mode: "warn" }).moderate(text);
    expect(r).toMatchObject({ text, action: "warn", allowed: true });
  });

  it("block marks content as not allowed", () => {
    const r = createModerationEngine({ mode: "block" }).moderate(text);
    expect(r).toMatchObject({ text, action: "block", allowed: false });
  });

  it("suggest offers case-matched replacements without changing text", () => {
    const r = createModerationEngine({ mode: "suggest" }).moderate("What the FUCK are you doing?");
    expect(r.text).toBe("What the FUCK are you doing?");
    expect(r.suggestedText).toBe("What the HECK are you doing?");
    expect(r.matches[0]!.suggestedReplacement).toBe("HECK");
  });

  it("suggest falls back to a masked form when the rule has no replacement", () => {
    const r = createModerationEngine({ mode: "suggest" }).moderate("slut");
    expect(r.suggestedText).toBe("sl*t");
  });

  it("setMode switches behaviour at runtime", () => {
    const e = createModerationEngine({ mode: "mask" });
    e.setMode("block");
    expect(e.moderate(text).allowed).toBe(false);
    expect(() => e.setMode("explode" as never)).toThrow(TypeError);
  });
});

describe("hate and harassment are contextual, not word replacement", () => {
  it("warns on targeted insults instead of masking them in mask mode", () => {
    const r = engine.moderate("you are such an idiot");
    expect(r.action).toBe("warn");
    expect(r.text).toBe("you are such an idiot");
    expect(r.matches[0]).toMatchObject({ category: "harassment", label: "insult", confidence: 0.8 });
  });

  it("does not flag the same adjective when it is not aimed at a person", () => {
    expect(engine.moderate("that was a stupid bug in my code").matches).toEqual([]);
  });

  it("treats reported speech as a mention", () => {
    const r = engine.moderate('He said "you are an idiot" to me');
    expect(r.matches[0]).toMatchObject({ context: "mention", requiresReview: true, confidence: 0.32 });
  });

  it("downgrades quoted harassment to review", () => {
    const r = engine.moderate('The ticket read: "you are an idiot" was posted at 3pm');
    expect(r.matches[0]).toMatchObject({ context: "quoted", action: "allow", requiresReview: true, confidence: 0.4 });
    expect(r.action).toBe("allow");
    expect(r.requiresReview).toBe(true);
  });

  it("downgrades mentions of a slur to review instead of masking", () => {
    const r = engine.moderate("Is the word faggot ever acceptable?");
    expect(r.matches[0]).toMatchObject({ category: "hate", context: "mention", requiresReview: true, action: "allow" });
    expect(r.text).toBe("Is the word faggot ever acceptable?");
  });

  it("masks a directly used slur", () => {
    const r = engine.moderate("shut up faggot");
    expect(r.matches[0]).toMatchObject({ category: "hate", label: "slur", action: "mask" });
    expect(r.text).toBe("shut up f*gg*t");
  });

  it("flags dehumanizing group statements as warn, not masked noise", () => {
    const r = engine.moderate("all immigrants should die");
    expect(r.matches[0]).toMatchObject({ ruleId: "en.hate.group-violence", action: "warn" });
    expect(r.text).toBe("all immigrants should die");
  });

  it("reports nested profanity and harassment independently", () => {
    const r = engine.moderate("you fucking idiot");
    expect(r.text).toBe("you f*ck*ng idiot");
    expect(r.action).toBe("warn");
    expect(r.matches.map((m) => [m.category, m.action])).toEqual([
      ["harassment", "warn"],
      ["profanity", "mask"],
    ]);
  });

  it("detects self-harm incitement and threats", () => {
    expect(engine.moderate("go kill yourself").matches[0]!.label).toBe("self-harm-incitement");
    expect(engine.moderate("kys").matches[0]!.label).toBe("self-harm-incitement");
    expect(engine.moderate("I'll kill you").matches[0]!.label).toBe("threat");
    expect(engine.moderate("I am going to hurt you").matches[0]!.label).toBe("threat");
  });

  it("respects configurable confidence thresholds", () => {
    const lenient = createModerationEngine({ policy: { harassment: { minConfidence: 0.3 } } });
    const r = lenient.moderate('He wrote "you are an idiot"');
    expect(r.matches[0]).toMatchObject({ action: "warn", requiresReview: false });
  });

  it("lets harassment be blocked while profanity is masked", () => {
    const e = createModerationEngine({ mode: "mask", policy: { harassment: { action: "block" } } });
    const r = e.moderate("you fucking idiot");
    expect(r).toMatchObject({ action: "block", allowed: false, text: "you f*ck*ng idiot" });
  });
});

describe("categories and policies", () => {
  it("only reports enabled categories", () => {
    const e = createModerationEngine({ categories: ["harassment"] });
    const r = e.moderate("fuck you are an idiot");
    expect(r.matches.map((m) => m.category)).toEqual(["harassment"]);
  });

  it("setPolicy merges overrides and validates input", () => {
    const e = createModerationEngine();
    e.setPolicy({ profanity: { action: "block" } });
    expect(e.moderate("shit").allowed).toBe(false);
    e.setPolicy({ hate: { minConfidence: 0.1 } });
    expect(e.moderate("shit").allowed).toBe(false); // earlier override kept
    expect(() => e.setPolicy({ hate: { minConfidence: 2 } })).toThrow(RangeError);
    expect(() => e.setPolicy({ hate: { action: "nope" as never } })).toThrow(TypeError);
  });

  it("rejects unknown categories and languages", () => {
    expect(() => createModerationEngine({ categories: ["spam" as never] })).toThrow(TypeError);
    expect(() => createModerationEngine({ language: "xx" })).toThrow(/No built-in dictionary pack/);
  });

  it("accepts regional language tags", () => {
    expect(createModerationEngine({ language: "en-GB" }).moderate("shit").text).toBe("sh*t");
  });
});

describe("rules", () => {
  it("adds and removes custom rules", () => {
    const e = createModerationEngine();
    e.addRule({ id: "app.banned", pattern: "(frak|frack*)", category: "custom", replacement: "darn" });
    expect(e.moderate("frak this, fracking toasters").text).toBe("fr*k this, fr*ck*ng toasters");
    expect(e.removeRule("app.banned")).toBe(true);
    expect(e.removeRule("app.banned")).toBe(false);
    expect(e.moderate("frak").matches).toEqual([]);
  });

  it("supports customWords including phrases", () => {
    const e = createModerationEngine({ customWords: ["Voldemort", "he who must not be named"] });
    const r = e.moderate("Voldemort is he who must not be named");
    expect(r.matches.map((m) => m.ruleId)).toEqual(["custom.voldemort", "custom.he-who-must-not-be-named"]);
  });

  it("custom rules win overlaps by priority", () => {
    const e = createModerationEngine({ rules: [{ id: "x", pattern: "fuck", category: "custom", priority: 99 }] });
    const r = e.moderate("fuck");
    expect(r.matches.find((m) => m.applied)!.ruleId).toBe("x");
    expect(r.text).toBe("f*ck");
  });

  it("resolves overlaps deterministically regardless of rule order", () => {
    const rules = [
      { id: "b", pattern: "foo bar", category: "custom" as const },
      { id: "a", pattern: "bar baz", category: "custom" as const },
    ];
    const one = createModerationEngine({ packs: [], rules, mode: "suggest" });
    const two = createModerationEngine({ packs: [], rules: [...rules].reverse(), mode: "suggest" });
    const pick = (e: typeof one) => e.moderate("foo bar baz").matches.filter((m) => m.applied).map((m) => m.ruleId);
    // Equal priority and length: the earlier match wins, independent of rule order.
    expect(pick(one)).toEqual(["b"]);
    expect(pick(two)).toEqual(["b"]);
  });

  it("getRules returns copies", () => {
    const e = createModerationEngine({ packs: [], rules: [{ id: "r", pattern: "x", category: "custom" }] });
    const [rule] = e.getRules();
    rule!.pattern = "y";
    expect(e.getRules()[0]!.pattern).toBe("x");
  });

  it.each([
    [{ id: "", pattern: "x", category: "custom" }, TypeError],
    [{ id: "a", pattern: "x", category: "spam" }, TypeError],
    [{ id: "a", pattern: "x", category: "custom", confidence: 3 }, RangeError],
    [{ id: "a", pattern: "x?", category: "custom" }, Error],
    [{ id: "a", pattern: "(x|y", category: "custom" }, Error],
    [{ id: "a", pattern: "   ", category: "custom" }, Error],
  ])("rejects invalid rule %j", (rule, ErrorType) => {
    expect(() => createModerationEngine().addRule(rule as never)).toThrow(ErrorType);
  });
});

describe("substring packs", () => {
  it("matches languages without word separators", () => {
    const e = createModerationEngine({
      packs: [{ language: "ja", boundary: "substring", rules: [{ id: "ja.x", pattern: "ばか", category: "profanity" }] }],
    });
    const r = e.moderate("あなたはばかです");
    expect(r.matches[0]).toMatchObject({ start: 4, end: 6, text: "ばか" });
  });

  it("refuses multi-token substring rules", () => {
    expect(() =>
      createModerationEngine({
        packs: [{ language: "ja", boundary: "substring", rules: [{ id: "x", pattern: "a b", category: "custom" }] }],
      }),
    ).toThrow(/single-token/);
  });
});

describe("events", () => {
  it("emits typed events via config callbacks and on()", () => {
    const onViolation = vi.fn();
    const onBlocked = vi.fn();
    const onWarning = vi.fn();
    const onModerated = vi.fn();
    const e = createModerationEngine({ mode: "block", onViolation, onBlocked, onWarning, onModerated });
    const listener = vi.fn();
    const off = e.on("violation", listener);

    e.moderate("hello");
    expect(onModerated).toHaveBeenCalledTimes(1);
    expect(onViolation).not.toHaveBeenCalled();

    e.moderate("shit");
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onWarning).not.toHaveBeenCalled();

    off();
    e.moderate("shit");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits warning for warn actions", () => {
    const onWarning = vi.fn();
    createModerationEngine({ onWarning }).moderate("you are an idiot");
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it("isolates throwing listeners and reports them as errors", () => {
    const onError = vi.fn();
    const e = createModerationEngine({ onError });
    e.on("moderated", () => {
      throw new Error("listener boom");
    });
    expect(() => e.moderate("fine")).not.toThrow();
    expect(onError).toHaveBeenCalledWith({ error: expect.objectContaining({ message: "listener boom" }) });
  });

  it("mask() does not emit events", () => {
    const onModerated = vi.fn();
    createModerationEngine({ onModerated }).mask("shit");
    expect(onModerated).not.toHaveBeenCalled();
  });
});

describe("mask() and validate()", () => {
  it("mask() masks actionable matches regardless of configured action", () => {
    const e = createModerationEngine({ mode: "block" });
    expect(e.mask("What the fuck")).toBe("What the f*ck");
  });

  it("validate() reports violations for server-side enforcement", () => {
    const e = createModerationEngine({ mode: "block" });
    expect(e.validate("hello there")).toMatchObject({ valid: true, violations: [] });
    const v = e.validate("you piece of shit");
    expect(v.valid).toBe(false);
    expect(v.violations.map((m) => m.ruleId)).toEqual(["en.harassment.piece-of", "en.profanity.shit"]);
  });
});
