import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

const engine = createModerationEngine();
const masked = (text: string) => engine.moderate(text).text;

describe("Hinglish (romanized Hindi) - on by default", () => {
  it.each([
    ["Behenchod", "B*h*nch*d"],
    ["bhenchod", "bh*nch*d"],
    ["bhanchod", "bh*nch*d"],
    ["madharchod", "m*dh*rch*d"],
    ["madarchod", "m*d*rch*d"],
    ["maderchod", "m*d*rch*d"],
    ["betichod", "b*t*ch*d"],
    ["lodu", "l*d*"],
    ["loduchand", "l*d*ch*nd"],
    ["lund", "l*nd"],
    ["lauda", "l**d*"],
    ["bhosidke", "bh*s*dk*"],
    ["bhosdike", "bh*sd*k*"],
    ["bhosada", "bh*s*d*"],
    ["bsdk", "b**k"],
    ["chutiya", "ch*t*y*"],
    ["gandu", "g*nd*"],
    ["harami", "h*r*m*"],
    ["bhadwa", "bh*dw*"],
    ["kutiya", "k*t*y*"],
    ["chhinal", "chh*n*l"],
  ])("masks %s", (input, expected) => {
    expect(masked(input)).toBe(expected);
  });

  it("masks only the abusive word inside common phrases", () => {
    expect(masked("maa ki chut")).toBe("maa ki ch*t");
    expect(masked("behen ka loda")).toBe("behen ka l*d*");
  });

  it("flags 'kutte ki aulad' but not a puppy", () => {
    expect(engine.moderate("kutte ki aulad").matches.map((m) => m.ruleId)).toContain("hi-latn.harassment.animal-offspring");
    expect(engine.moderate("kutte ka baccha kitna cute hai").matches).toEqual([]);
  });

  it("flags insults aimed at someone's family as harassment", () => {
    const r = engine.moderate("teri maa ka bhosada");
    expect(r.text).toBe("teri maa ka bh*s*d*");
    expect(r.action).toBe("warn");
    expect(r.matches.map((m) => m.ruleId)).toContain("hi-latn.harassment.family-insult");
    expect(engine.moderate("maa chod di").action).toBe("warn");
  });

  it("handles obfuscation the same way as English", () => {
    expect(masked("BHENCHODDD")).toBe("BH*NCH*DDD");
    expect(masked("bh3nch0d")).toBe("bh*nch*d");
    expect(masked("c h u t i y a")).toBe("c h * t * y *");
  });

  it.each([
    "mujhe chod do",
    "chod do yaar",
    "Asha Bhosle sang beautifully",
    "chutney with rice",
    "the kutti is sleeping",
    "Randi Zuckerberg",
    "BC and MC at BKC",
    "Lodur in Norse myths",
    "Gand is the French name for Ghent",
  ])("does not flag %j", (text) => {
    expect(engine.moderate(text).matches).toEqual([]);
  });

  it("can be turned off with languages", () => {
    const englishOnly = createModerationEngine({ languages: ["en"] });
    expect(englishOnly.moderate("bhenchod").matches).toEqual([]);
    expect(englishOnly.moderate("fuck").text).toBe("f*ck");
    const hinglishOnly = createModerationEngine({ languages: ["hi-Latn"] });
    expect(hinglishOnly.moderate("bhenchod").text).toBe("bh*nch*d");
    expect(hinglishOnly.moderate("fuck").matches).toEqual([]);
  });

  it("suggest mode offers a masked alternative", () => {
    expect(createModerationEngine({ mode: "suggest" }).moderate("chutiya").suggestedText).toBe("ch*t*y*");
  });
});
