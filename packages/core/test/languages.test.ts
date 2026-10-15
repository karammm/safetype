import { packs } from "@safetype/dictionaries";
import { describe, expect, it } from "vitest";
import { createModerationEngine } from "../src";
import { maskText } from "../src/engine/transformer";
import { normalize } from "../src/engine/normalizer";

const LANGUAGES = ["es", "fr", "de", "pt", "hi"] as const;

/** Text that must be flagged, and everyday text in the same language that must be left alone. */
const CASES: Record<(typeof LANGUAGES)[number], { flagged: string[]; clean: string[] }> = {
  es: {
    flagged: [
      "¡Qué mierda!", "eres un idiota", "hijo de puta", "cabrón", "Vete a la mierda", "mátate",
      "te voy a matar", "los inmigrantes deberían morir", "maricón", "PENDEJO", "concha de tu madre", "gilipollas",
      "sos un boludo", "eres un weón", "usted es un idiota", "pelotudo", "mamagüevo", "malnacido", "culero",
      "te voy a romper la cara", "lo voy a matar",
    ],
    clean: [
      "Compré un cono de helado", "Voy a coger el autobús", "La polla de la lotería", "El zorro y la zorra",
      "Me gusta la pasta con queso", "Los inmigrantes deberían votar", "Eres muy amable", "computadora putativa",
      "che boludo, ¿venís?", "¡Qué chingón!", "el pinche de cocina", "la voy a romper en el examen", "un huevo de pascua",
    ],
  },
  fr: {
    flagged: [
      "Putain, c'est de la merde", "t'es un connard", "va te faire foutre", "nique ta mère", "sale con",
      "je vais te tuer", "tu es vraiment une idiote", "enculé", "les juifs doivent mourir", "personne ne t'aime",
      "Tabarnak!", "Câlisse que c'est long", "ostie de niaiseux", "ntm", "ftg", "sale pédé", "espèce de bâtard", "t'es un bâtard",
    ],
    clean: [
      "Les pros et les cons", "Une baguette et un bâton", "Je vais te voir demain", "C'est unique",
      "La chienne du voisin a eu des chiots", "Il faut tuer le temps",
      "Un bâtard et deux croissants", "Le calice et l'hostie", "Les pneus crissent", "le saint sacrement",
    ],
  },
  de: {
    flagged: [
      "Scheiße!", "Scheisse", "du Arschloch", "Du bist so ein Idiot", "Hurensohn", "Verpiss dich", "bring dich um",
      "Häng dich auf", "Ich bringe dich um", "Arschlöcher", "niemand mag dich", "Ausländer sollten alle vergast werden",
    ],
    clean: [
      "Ihr Hund ist süß", "Häng dich rein, du schaffst das!", "Der Mist am Morgen", "Das ist schlampig gemacht",
      "Sie sind sehr nett", "a fickle friend",
    ],
  },
  pt: {
    flagged: [
      "Porra, que merda", "você é um idiota", "vai tomar no cu", "filho da puta", "caralho", "vai se matar",
      "vou te matar", "viado", "fdp", "morre logo", "ninguém gosta de você",
    ],
    clean: [
      "Ele pede desculpas", "Vi um veado na floresta", "A bicha do supermercado", "O macaco subiu na árvore",
      "O cantor morre aos 80 anos", "Você é muito gentil", "Vou te ligar amanhã",
    ],
  },
  hi: {
    flagged: [
      "चूतिया है तू", "मादरचोद", "भोसड़ी के", "भोसडीके", "तेरी माँ की चूत", "तू बेवकूफ है", "तू गधा है", "डूब मर",
      "तुझे जान से मार दूंगा", "लंड", "मुसलमानों को मार दो", "आत्महत्या कर ले", "रंडी",
    ],
    clean: [
      "हम लड़ रहे हैं", "चौदह साल", "मेरा कुत्ता बहुत प्यारा है", "तुम कुत्ते को खाना दो", "आत्महत्या कर ली", "लोड बढ़ गया",
      "अर्जुन का गांडीव", "बाल कटवा लिए", "मुसलमानों को मार दिया गया, पुलिस ने कहा", "माँ ने खाना बनाया", "सब्जी मंडी",
    ],
  },
};

describe.each(LANGUAGES)("language pack %s", (language) => {
  const engine = createModerationEngine({ languages: [language] });

  it.each(CASES[language].flagged)("flags %s", (text) => {
    expect(engine.moderate(text).matches.length).toBeGreaterThan(0);
  });

  it.each(CASES[language].clean)("leaves %s alone", (text) => {
    expect(engine.moderate(text).matches).toEqual([]);
  });

  it("rule ids are namespaced and unique", () => {
    const ids = packs[language]!.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${language}.`)).toBe(true);
  });
});

describe("language selection", () => {
  it("new packs are opt-in: the default engine is unchanged", () => {
    const engine = createModerationEngine();
    for (const text of ["Scheiße", "puta", "मादरचोद", "caralho", "connard"]) {
      expect(engine.moderate(text).matches).toEqual([]);
    }
    expect(engine.moderate("fuck").text).toBe("f*ck");
  });

  it("combines packs", () => {
    const engine = createModerationEngine({ languages: ["en", "es", "de"] });
    expect(engine.moderate("fuck, mierda, Scheiße").text).toBe("f*ck, m**rd*, Sch**ß*");
  });

  it("language picks a region's base pack", () => {
    expect(createModerationEngine({ language: "pt-BR" }).moderate("porra").text).toBe("p*rr*");
    expect(createModerationEngine({ language: "es-MX" }).moderate("pendejo").text).toBe("p*nd*j*");
  });

  it('language "hi" enables both scripts; "hi-Latn" only romanized Hindi', () => {
    expect(createModerationEngine({ language: "hi" }).moderate("मादरचोद bhenchod").text).toBe("मा***द bh*nch*d");
    expect(createModerationEngine({ language: "hi-Latn" }).moderate("मादरचोद bhenchod").text).toBe("मादरचोद bh*nch*d");
  });

  it("an unknown language still throws", () => {
    expect(() => createModerationEngine({ languages: ["xx"] })).toThrow(/No built-in dictionary pack/);
  });
});

describe("Devanagari", () => {
  const engine = createModerationEngine({ languages: ["hi"] });

  it("keeps vowel signs and nukta when normalizing", () => {
    expect(normalize("लंड").text).not.toBe(normalize("लड़").text);
    expect(normalize("चोद").text).not.toBe(normalize("चौद").text);
  });

  it("treats candrabindu and anusvara as the same", () => {
    expect(normalize("माँ").text).toBe(normalize("मां").text);
  });

  it("matches precomposed and decomposed nukta letters alike", () => {
    const precomposed = "भोसड़ी"; // ड + nukta
    const composed = "भोसड़ी"; // ड़ as one code point
    const rules = (text: string) => engine.moderate(text).matches.map((m) => m.ruleId);
    expect(rules(precomposed)).toContain("hi.profanity.bhosda");
    expect(rules(composed)).toEqual(rules(precomposed));
  });

  it("masks whole characters, never leaving a stray vowel sign", () => {
    expect(maskText("चूतिया")).toBe("चू*या");
    expect(maskText("चूतिया", "full")).toBe("***");
    expect(engine.moderate("तू चूतिया है").text).toBe("तू चू*या है");
  });

  it("masking is idempotent", () => {
    const once = engine.mask("चूतिया लंड रंडी");
    expect(engine.mask(once)).toBe(once);
  });

  it("never masks only a trailing leet digit (found by fuzzing)", () => {
    // "0" reads as the vowel "o"; masking just it gave "चूतिया*", which the next pass treated as emphasis.
    const once = engine.moderate("चूतिया0").text;
    expect(once).toBe("चू**0");
    expect(engine.moderate(once).text).toBe(once);
  });

  it("maps offsets back to the original text", () => {
    const text = "अरे चूतिया!";
    const [match] = engine.moderate(text).matches;
    expect(text.slice(match!.start, match!.end)).toBe("चूतिया");
  });
});

describe("German sharp s", () => {
  it("ß matches ss in both directions", () => {
    const engine = createModerationEngine({ languages: ["de"] });
    expect(engine.moderate("SCHEISSE").matches).toHaveLength(1);
    expect(engine.moderate("Scheiße").matches).toHaveLength(1);
    expect(normalize("Straße").text).toBe("strasse");
  });
});
