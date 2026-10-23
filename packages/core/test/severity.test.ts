import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";

describe("severity overrides", () => {
  it("raises a low-severity word above the profanity threshold", () => {
    expect(createModerationEngine().moderate("damn it").matches).toEqual([]);
    const e = createModerationEngine({ severity: { damn: "medium" } });
    const r = e.moderate("damn it");
    expect(r.text).toBe("d*mn it");
    expect(r.matches[0]).toMatchObject({ ruleId: "en.profanity.damn", severity: "medium" });
  });

  it("word keys cover every form the rule's pattern matches", () => {
    const e = createModerationEngine({ severity: { damn: "high" } });
    expect(e.moderate("goddamned damning").matches.map((m) => m.severity)).toEqual(["high", "high"]);
  });

  it("a key for a specific form only affects that form", () => {
    const e = createModerationEngine({ severity: { damned: "medium" } });
    expect(e.moderate("damned damn").matches.map((m) => m.text)).toEqual(["damned"]);
  });

  it("lowers a word below the threshold so it is ignored", () => {
    const e = createModerationEngine({ severity: { shit: "low" } });
    expect(e.moderate("oh shit").matches).toEqual([]);
    expect(e.moderate("fuck").matches).toHaveLength(1);
  });

  it("accepts rule ids, which win over word keys", () => {
    const e = createModerationEngine({ severity: { "en.profanity.damn": "critical", damn: "medium" } });
    expect(e.moderate("damn").matches[0]!.severity).toBe("critical");
  });

  it("normalizes word keys like dictionary values", () => {
    const e = createModerationEngine({ severity: { "  DAMN ": "medium" } });
    expect(e.getSeverityOverrides()).toEqual({ damn: "medium" });
    expect(e.moderate("Damn").matches).toHaveLength(1);
  });

  it("applies to custom words", () => {
    const e = createModerationEngine({ customWords: ["Voldemort"], severity: { voldemort: "critical" } });
    expect(e.moderate("Voldemort").matches[0]).toMatchObject({ ruleId: "custom.voldemort", severity: "critical" });
  });

  it("works with per-severity policies", () => {
    const e = createModerationEngine({ policy: { profanity: { minSeverity: "high" } }, severity: { shit: "critical" } });
    expect(e.moderate("shit happens").matches).toHaveLength(1);
    expect(e.moderate("bullshit").matches).toEqual([]);
  });

  it("can be changed at runtime", () => {
    const e = createModerationEngine();
    e.setSeverity("damn", "high");
    expect(e.moderate("damn").matches).toHaveLength(1);
    e.setSeverity("en.profanity.fuck", "low");
    expect(e.moderate("fuck").matches).toEqual([]);
    expect(e.getSeverityOverrides()).toEqual({ damn: "high", "en.profanity.fuck": "low" });
    expect(e.resetSeverity("DAMN")).toBe(true);
    expect(e.resetSeverity("damn")).toBe(false);
    expect(e.resetSeverity("en.profanity.fuck")).toBe(true);
    expect(e.moderate("damn fuck").matches.map((m) => m.text)).toEqual(["fuck"]);
  });

  it("keeps a rule id override after the rule is removed", () => {
    const e = createModerationEngine();
    e.setSeverity("en.profanity.damn", "high");
    e.removeRule("en.profanity.damn");
    expect(e.resetSeverity("en.profanity.damn")).toBe(true);
  });

  it("rejects unknown severities and empty targets", () => {
    expect(() => createModerationEngine({ severity: { damn: "extreme" as never } })).toThrow(/Unknown severity/);
    const e = createModerationEngine();
    expect(() => e.setSeverity("damn", "nope" as never)).toThrow(/Unknown severity/);
    expect(() => e.setSeverity(" ", "high")).toThrow(/non-empty/);
  });
});
