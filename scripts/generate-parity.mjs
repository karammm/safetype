// Runs the JavaScript engine over shared cases and records the results. The Python port's tests
// replay the same cases and must produce identical output. Offsets are converted from UTF-16 code
// units (JS) to code points (Python). CI fails if the committed fixture is out of date.
import { writeFileSync } from "node:fs";
import { createModerationEngine } from "../packages/core/dist/index.js";

const texts = [
  "What the fuck are you doing?", "FUCK", "Fuck off", "fucking fucker motherfucker", "bullshit",
  "shit, this bitch is an asshole", "Have a lovely day!", "Scunthorpe", "the class assassin",
  "as a matter of fact", "pass the bass", "cocktail hour", "shiitake mushrooms", "Dickens wrote novels",
  "assess the situation", "damn it", "you bastard", "FUUUUCK", "sh1t", "$hit", "f u c k", "f.u.c.k",
  "fück", "ｆｕｃｋ", "fuсk", "fu​ck", "*fuck*", "fuck!",
  "I owe you $5 and 1000 points", "I am a b c d", "😀 ﬁne ｆｕｃｋ",
  "f*ck", "you are such an idiot", "that was a stupid bug in my code",
  "The ticket read: \"you are an idiot\" was posted at 3pm", "He said \"you are an idiot\" to me",
  "Is the word faggot ever acceptable?", "shut up faggot", "all immigrants should die",
  "you fucking idiot", "go kill yourself", "kys", "I'll kill you", "I am going to hurt you",
  "you piece of shit", "you're a piece of shit", "nobody likes you", "u r a loser",
  "What the FUCK is this?", "slut", "this is shit", "line one shit\nline two", "“you are an idiot”",
  "the word shit", "Voldemort is he who must not be named", "frak this, fracking toasters", "",
  "Behenchod, madharchod, betichod", "maa ki chut", "behen ka loda", "teri maa ka bhosada",
  "lodu, lund, bhosidke, bsdk, loduchand", "chutiya gandu harami bhadwa kutiya", "BHENCHODDD bh3nch0d",
  "c h u t i y a", "maa chod di", "mujhe chod do", "Asha Bhosle and chutney", "kutti randi BC MC BKC",
  "¡Qué mierda, cabrón!", "eres un idiota", "concha de tu madre", "Compré un cono de helado", "mátate",
  "Putain, t'es un connard", "va te faire foutre", "Les pros et les cons", "je vais te tuer",
  "Scheiße, du Arschloch", "Ihr Hund ist süß", "Häng dich rein!", "Häng dich auf", "SCHEISSE",
  "Porra, você é um idiota", "vai tomar no cu", "Ele pede desculpas", "O cantor morre aos 80 anos",
  "चूतिया है तू", "भोसड़ी के", "तेरी माँ की चूत", "हम लड़ रहे हैं", "चौदह साल", "तुझे जान से मार दूंगा",
  "मादरचोद bhenchod", "c h u t i y a चूतिया", "चूतिया0", "चूतिया0@ चूतियाo",
  "porn", "watching porn tonight", "send nudes", "send me your nudes pls", "show me nude pics", "the sex of the patient",
  "Essex and unisex", "a nude painting", "the word \"porn\"", "bhosada", "abe lodu harami", "nangi photo bhej",
  "पोर्न", "नंगी फोटो भेज", "हरामी", "dick pics", "seggs",
  "ghar me ghus ke chodunga saale", "tujhe jaan se maar daalunga", "tujhe nahi chhodunga", "abe saale",
  "kal main ghar chodunga", "mere saale ki shaadi hai", "घर में घुस के मारूंगा", "मेरे साले की शादी है",
];

const configs = [
  { name: "default", config: {} },
  { name: "suggest", config: { mode: "suggest" } },
  { name: "warn", config: { mode: "warn" } },
  { name: "block", config: { mode: "block" } },
  { name: "allow", config: { mode: "allow" } },
  { name: "strict-low", config: { policy: { profanity: { minSeverity: "low" } } } },
  { name: "harassment-block", config: { mode: "mask", policy: { harassment: { action: "block", minConfidence: 0.3 } } } },
  { name: "partial", config: { maskStyle: "partial" } },
  { name: "full-hash", config: { maskStyle: "full", maskChar: "#" } },
  { name: "custom", config: { customWords: ["Voldemort", "he who must not be named"], allowList: ["bastard"], rules: [{ id: "app.frak", pattern: "(frak|frack*)", category: "custom", replacement: "darn" }] } },
  { name: "categories", config: { categories: ["harassment", "hate"] } },
  { name: "no-spaced", config: { detectSpacedLetters: false } },
  { name: "english-only", config: { languages: ["en"] } },
  { name: "hinglish-only", config: { languages: ["hi-Latn"], mode: "block" } },
  { name: "spanish", config: { languages: ["es"] } },
  { name: "french", config: { languages: ["fr"], mode: "suggest" } },
  { name: "german", config: { languages: ["de"], maskStyle: "partial" } },
  { name: "portuguese", config: { language: "pt-BR" } },
  { name: "hindi", config: { language: "hi" } },
  { name: "hindi-full", config: { languages: ["hi"], maskStyle: "full" } },
  { name: "sexual-off", config: { policy: { sexual: { action: "allow" } } } },
  { name: "sexual-block", config: { policy: { sexual: { action: "block", minConfidence: 0.5 } } } },
  { name: "multilingual", config: { languages: ["en", "es", "fr", "de", "pt", "hi", "hi-Latn"] } },
];

const cp = (text, offset) => Array.from(text.slice(0, offset)).length;

const cases = [];
for (const { name, config } of configs) {
  const engine = createModerationEngine(config);
  for (const text of texts) {
    const r = engine.moderate(text);
    cases.push({
      config: name,
      input: text,
      expected: {
        text: r.text,
        suggestedText: r.suggestedText,
        action: r.action,
        allowed: r.allowed,
        requiresReview: r.requiresReview,
        masked: engine.mask(text),
        matches: r.matches.map((m) => ({
          start: cp(text, m.start),
          end: cp(text, m.end),
          text: m.text,
          ruleId: m.ruleId,
          category: m.category,
          severity: m.severity,
          action: m.action,
          confidence: m.confidence,
          context: m.context,
          applied: m.applied,
          requiresReview: m.requiresReview,
          suggestedReplacement: m.suggestedReplacement ?? null,
          label: m.label ?? null,
        })),
      },
    });
  }
}

const target = new URL("../python/tests/fixtures/parity.json", import.meta.url);
writeFileSync(target, JSON.stringify({ configs: Object.fromEntries(configs.map((c) => [c.name, c.config])), cases }, null, 1) + "\n");
console.log(`wrote ${cases.length} parity cases -> ${target.pathname}`);
