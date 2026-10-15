import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

/** Every output shown on the documentation site (apps/docs) and in the README. If one changes, update the docs. */
describe("documented examples", () => {
  const engine = createModerationEngine({ mode: "mask" });

  it("getting started", () => {
    expect(engine.moderate("What the fuck are you doing?").text).toBe("What the f*ck are you doing?");
    expect(engine.moderate("Scunthorpe has a class assassin").matches).toEqual([]);
  });

  it("context", () => {
    expect(engine.moderate('He said "you are an idiot" to me').requiresReview).toBe(true);
    expect(engine.moderate("you are an idiot").action).toBe("warn");
  });

  it("mask styles", () => {
    expect(createModerationEngine({ maskStyle: "vowels" }).moderate("fuck").text).toBe("f*ck");
    expect(createModerationEngine({ maskStyle: "partial" }).moderate("fuck").text).toBe("f**k");
    expect(createModerationEngine({ maskStyle: "full", maskChar: "#" }).moderate("fuck").text).toBe("####");
    expect(createModerationEngine({ maskStyle: () => "[removed]" }).moderate("fuck").text).toBe("[removed]");
  });

  it("policies", () => {
    const strict = createModerationEngine({ mode: "mask", policy: { profanity: { minSeverity: "low" } } });
    expect(strict.moderate("damn").text).toBe("d*mn");
    expect(engine.moderate("damn").matches).toEqual([]);
  });

  it("rules and allow lists", () => {
    const custom = createModerationEngine({
      customWords: ["Voldemort"],
      allowList: ["bastard"],
      rules: [{ id: "app.frak", pattern: "(frak|frack*)", category: "custom", severity: "medium", replacement: "darn" }],
    });
    expect(custom.moderate("Voldemort, you bastard, frak").text).toBe("V*ld*m*rt, you bastard, fr*k");
    expect(custom.removeRule("en.profanity.damn")).toBe(true);
  });

  it("languages", () => {
    expect(createModerationEngine({ language: "hi" }).moderate("तू चूतिया है").text).toBe("तू चू*या है");
    expect(createModerationEngine({ languages: ["en", "es", "fr"] }).moderate("mierda").matches).toHaveLength(1);
  });

  it("server enforcement", () => {
    const server = createModerationEngine({ mode: "mask", policy: { hate: { action: "block" }, harassment: { action: "block" } } });
    const ok = server.validate("this is shit");
    expect(ok.valid).toBe(true);
    expect(ok.result.text).toBe("this is sh*t");
    const rejected = server.validate("you are an idiot");
    expect(rejected.valid).toBe(false);
    expect(rejected.violations[0]!.category).toBe("harassment");
  });
});
