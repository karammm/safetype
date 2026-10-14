import { describe, expect, it } from "vitest";
import { applyEdits, createModerationEngine, maskText, matchCase } from "../src";

describe("maskText", () => {
  it.each([
    ["fuck", "vowels", "f*ck"],
    ["kys", "vowels", "k*s"],
    ["fuck", "partial", "f**k"],
    ["ab", "partial", "a*"],
    ["f u c k", "full", "* * * *"],
    ["", "vowels", ""],
    ["!!", "vowels", "!*"],
  ] as const)("%j with %s -> %j", (input, style, expected) => {
    expect(maskText(input, style)).toBe(expected);
  });
});

describe("matchCase", () => {
  it.each([
    ["fuck", "heck", "heck"],
    ["Fuck", "heck", "Heck"],
    ["FUCK", "heck", "HECK"],
    ["F", "heck", "Heck"],
  ])("%s -> %s", (source, replacement, expected) => {
    expect(matchCase(source, replacement)).toBe(expected);
  });
});

describe("offset mapping", () => {
  it("is identity for same-length masks", () => {
    const r = createModerationEngine().moderate("What the fuck are you doing?");
    for (let i = 0; i <= r.originalText.length; i++) {
      expect(r.mapping.toTransformed(i)).toBe(i);
      expect(r.mapping.toOriginal(i)).toBe(i);
    }
  });

  it("maps offsets across length-changing edits", () => {
    //            0123456789
    const text = "aa XX bb YY cc";
    const { text: out, mapping } = applyEdits(text, [
      { start: 3, end: 5, replacement: "LONGER" },
      { start: 9, end: 11, replacement: "" },
    ]);
    expect(out).toBe("aa LONGER bb  cc");
    // before, at and after the first edit
    expect(mapping.toTransformed(2)).toBe(2);
    expect(mapping.toTransformed(3)).toBe(3);
    expect(mapping.toTransformed(5)).toBe(9);
    expect(mapping.toTransformed(7)).toBe(11);
    // inside a deleted range collapses to the edit position
    expect(mapping.toTransformed(10)).toBe(13);
    expect(mapping.toTransformed(text.length)).toBe(out.length);
    // reverse direction
    expect(mapping.toOriginal(9)).toBe(5);
    expect(mapping.toOriginal(11)).toBe(7);
    expect(mapping.toOriginal(out.length)).toBe(text.length);
    // clamps out-of-range input
    expect(mapping.toTransformed(-5)).toBe(0);
    expect(mapping.toTransformed(999)).toBe(out.length);
  });

  it("round-trips every offset outside edited ranges", () => {
    const text = "x fuck y shit z";
    const r = createModerationEngine({ maskStyle: () => "[censored]" }).moderate(text);
    const edited = r.mapping.edits;
    for (let i = 0; i <= text.length; i++) {
      if (edited.some((e) => i > e.start && i < e.end)) continue;
      expect(r.mapping.toOriginal(r.mapping.toTransformed(i))).toBe(i);
    }
    expect(r.text).toBe("x [censored] y [censored] z");
  });

  it("rejects overlapping edits", () => {
    expect(() =>
      applyEdits("abcdef", [
        { start: 0, end: 3, replacement: "" },
        { start: 2, end: 4, replacement: "" },
      ]),
    ).toThrow(RangeError);
  });
});
