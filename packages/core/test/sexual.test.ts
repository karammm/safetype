import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

describe("sexual content", () => {
  const engine = createModerationEngine();

  it.each(["porn", "watching porn", "pornhub", "sex", "lets have sex", "sexting", "seggs", "horny", "send nudes", "send me your nudes pls", "show me nude pics", "any nudes?", "dick pics", "nangi photo bhej"])(
    "warns about %s without masking it",
    (text) => {
      const r = engine.moderate(text);
      expect(r.action).toBe("warn");
      expect(r.text).toBe(text);
      expect(r.matches.some((m) => m.category === "sexual" && m.action === "warn")).toBe(true);
    },
  );

  it.each(["Essex and unisex", "Super Bowl XXX", "love you xxx", "a nude painting", "a sexy car", "sussex", "Middlesex"])(
    "leaves %s alone",
    (text) => {
      expect(engine.moderate(text).matches).toEqual([]);
    },
  );

  it("follows the mode: blocks in block mode, reports in allow mode", () => {
    expect(createModerationEngine({ mode: "block" }).moderate("send nudes").allowed).toBe(false);
    expect(createModerationEngine({ mode: "allow" }).moderate("send nudes").action).toBe("allow");
  });

  it("can be turned off", () => {
    expect(createModerationEngine({ policy: { sexual: { action: "allow" } } }).moderate("sex").action).toBe("allow");
    expect(createModerationEngine({ categories: ["profanity", "hate", "harassment", "custom"] }).moderate("porn").matches).toEqual([]);
  });

  it("quoted or mentioned sexual words need review instead of a warning", () => {
    const r = engine.moderate('the word "porn" is in the dictionary');
    expect(r.matches[0]!.requiresReview).toBe(true);
    expect(r.action).toBe("allow");
  });
});

describe("Hinglish gaali are masked and warned about", () => {
  const engine = createModerationEngine();

  it.each([
    ["bhosada", "bh*s*d*"],
    ["bhosdike", "bh*sd*k*"],
    ["lodu", "l*d*"],
    ["harami", "h*r*m*"],
    ["teri maa ka bhosada", "teri maa ka bh*s*d*"],
  ])("%s", (text, masked) => {
    const r = engine.moderate(text);
    expect(r.text).toBe(masked);
    expect(r.action).toBe("warn");
  });

  it("Devanagari gaali too", () => {
    const r = createModerationEngine({ language: "hi" }).moderate("हरामी");
    expect(r.text).toBe("ह*मी");
    expect(r.action).toBe("warn");
  });
});
