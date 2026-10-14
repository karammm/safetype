import { bench, describe } from "vitest";
import { createModerationEngine } from "../src";

const engine = createModerationEngine();
const paragraph =
  "The quick brown fox jumps over the lazy dog. What the fuck are you doing? You are such an idiot, honestly. " +
  "Scunthorpe residents enjoy shiitake mushrooms and classic assassin films. ";
const large = paragraph.repeat(1000); // ~170 KB
const sentence = "What the fuck are you doing? you are such an idiot";

describe("moderate()", () => {
  bench("short sentence", () => {
    engine.moderate(sentence);
  });

  bench("large text (~170 KB)", () => {
    engine.moderate(large);
  });

  bench("repeated typing: re-moderate every keystroke of a 50-char message", () => {
    for (let i = 1; i <= sentence.length; i++) engine.moderate(sentence.slice(0, i));
  });
});
