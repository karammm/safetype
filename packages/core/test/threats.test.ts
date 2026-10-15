import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

describe("Hinglish threats and abusive address", () => {
  const engine = createModerationEngine();

  it.each([
    "ghar me ghus ke chodunga saale",
    "Ghar mein ghuske maarunga",
    "ghar aake todunga",
    "tujhe maar dunga",
    "tujhe jaan se maar daalunga",
    "tereko khatam kar dunga",
    "tujhe chodunga",
    "tujhe nahi chhodunga",
    "tujhe toh nahi chodunga",
    "abe saale",
    "saale kutte",
    "oye kamine",
  ])("warns: %s", (text) => {
    const r = engine.moderate(text);
    expect(r.action).toBe("warn");
    expect(r.matches.some((m) => m.category === "harassment")).toBe(true);
  });

  // "chodunga" is also a spelling of "chhodunga" (I'll leave), and "saale" also means brother-in-law.
  it.each([
    "kal main ghar chodunga",
    "mere saale ki shaadi hai",
    "saale sahab aa gaye",
    "ghar me ghus ke dekha",
    "ghar aake khana khaunga",
    "maine use chhod diya",
    "tujhe ghar chhod dunga",
    "tujhe call karunga",
    "ghar par aa jaana",
    "tujhe pata hai",
  ])("leaves alone: %s", (text) => {
    expect(engine.moderate(text).matches).toEqual([]);
  });

  it("can block threats on the server", () => {
    const server = createModerationEngine({ policy: { harassment: { action: "block" } } });
    expect(server.validate("ghar me ghus ke chodunga saale").valid).toBe(false);
  });
});

describe("Hindi (Devanagari) threats", () => {
  const engine = createModerationEngine({ language: "hi" });

  it.each(["घर में घुस के मारूंगा", "तुझे नहीं छोड़ूंगा", "अबे साले", "तुझे चोदूंगा"])("warns: %s", (text) => {
    expect(engine.moderate(text).action).toBe("warn");
  });

  it.each(["मेरे साले की शादी है", "घर में घुस के देखा"])("leaves alone: %s", (text) => {
    expect(engine.moderate(text).matches).toEqual([]);
  });
});
