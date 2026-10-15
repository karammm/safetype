import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * Hindi in Devanagari script. Opt-in: `languages: ["hi"]`; `language: "hi"` enables it together with
 * romanized Hinglish (`hi-Latn`).
 *
 * Vowel signs, viramas and nuktas are kept by the normalizer, so "लंड" never matches "लड़" (fight)
 * and "चोद" never matches "चौदह" (fourteen). Candrabindu and anusvara are treated as the same
 * ("माँ" = "मां"), and a prefix without nukta also covers the nukta spelling ("भोसड*" covers "भोसड़ी").
 * Left out because they are ordinary words: "साला" (brother-in-law), "हराम" (forbidden), "लोड" (load),
 * "लौंडा" (boy), "गांडीव" (Arjuna's bow), "कटवा" (got it cut), and caste names, which are also used
 * for self-identification. "साला" is still caught in abuse ("अबे साले", "साले कुत्ते"), and "हिजड़ा"
 * (also an identity) only as a statement about someone ("तू हिजड़ा है"), like the animal words.
 */

const profanity: ModerationRule[] = [
  {
    id: "hi.profanity.madarchod",
    pattern: "(मादरचोद*|मादरचौद*|मादरचोत|मादरजात|मादरज़ात)",
    category: "profanity",
    severity: "high",
  },
  {
    id: "hi.profanity.behenchod",
    pattern: "(बहनचोद*|बहेनचोद*|बहिनचोद*|भेनचोद*|भैनचोद*|बहनचौद*|भैंचोद*)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi.profanity.betichod", pattern: "(बेटीचोद*|बेटिचोद*)", category: "profanity", severity: "high" },
  { id: "hi.profanity.chod", pattern: "(चोद*|चुद*)", category: "profanity", severity: "high" },
  {
    id: "hi.profanity.chutiya",
    pattern: "(चूतिया*|चुतिया*|चूतिये*|चुतिये*|चुत्या*|चूत्या*)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi.profanity.chut", pattern: "(चूत|चुत)", category: "profanity", severity: "high" },
  {
    id: "hi.profanity.lund",
    pattern: "(लंड|लण्ड|लन्ड|लौड़ा|लौडा|लौड़े|लौडे|लोड़ा|लोड़े|लवड़ा|लवडा|लवड़े|लौड़ू|लोड़ू|लोडू)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi.profanity.bhosda", pattern: "(भोसड*|भोसरी*)", category: "profanity", severity: "high" },
  {
    id: "hi.profanity.gaandu",
    pattern: "(गांड|गांडू|गांडु|गाण्डू|गान्डू|गाण्ड|गान्ड|गांडफट*)",
    category: "profanity",
    severity: "medium",
  },
  {
    id: "hi.profanity.harami",
    pattern: "(हरामी|हरामज़ाद*|हरामजाद*|हरामखोर*|हरामख़ोर*)",
    category: "profanity",
    severity: "medium",
  },
  {
    id: "hi.profanity.randi",
    pattern: "(रंडी|रण्डी|रन्डी|रंडियों|रंडिया|रंडीबाज*|रंडवा|रांड)",
    category: "profanity",
    severity: "high",
  },
  {
    id: "hi.profanity.bhadwa",
    pattern: "(भड़वा|भड़वे|भड़वी|भडवा|भडवे|भडवी|भड़ुआ|भडुआ)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi.profanity.jhaat", pattern: "(झाट|झांट|झाटू|झांटू)", category: "profanity", severity: "medium" },
  { id: "hi.profanity.chhinal", pattern: "(छिनाल|छिनार|छिनाली)", category: "profanity", severity: "high" },
  { id: "hi.profanity.dalla", pattern: "(दल्ला|दल्ले|दल्ली)", category: "profanity", severity: "medium" },
  { id: "hi.profanity.kutiya", pattern: "(कुतिया|कुत्तिया)", category: "profanity", severity: "high" },
];

const groups =
  "(मुसलमानों|मुसलमान|मुसलमानो|हिंदुओं|हिन्दुओं|हिंदुओ|सिखों|ईसाइयों|दलितों|कटुओं|मुल्लों|बिहारियों|औरतों)";

const hate: ModerationRule[] = [
  {
    id: "hi.hate.slur.katua",
    pattern: "(कटुआ|कटुए|कटुओं)",
    category: "hate",
    severity: "critical",
    confidence: 0.9,
    label: "slur",
  },
  {
    // The bare stem ("ko maar") is also past-tense news ("ko maar diya gaya"), so it needs an imperative ending.
    id: "hi.hate.group-violence",
    pattern: `${groups} (को)? (मार|काट|जला|खत्म|ख़त्म|मिटा|साफ) (कर)? (दो|डालो|देना)`,
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
  {
    id: "hi.hate.group-violence-imperative",
    pattern: `${groups} (को)? (मारो|काटो|जलाओ|मिटाओ)`,
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
];

const you = "(तू|तुम|आप)";
const degree = "(एक)? (बहुत|पूरा|पूरी|निरा|सबसे|एकदम)? (बड़ा|बड़ी|बडा|बडी)?";
// Animal words are only insults as a statement about someone ("तू गधा है"), not in "तुम कुत्ते को खाना दो".
const animals = "(कुत्ता|कुत्ते|कुत्ती|गधा|गधे|उल्लू|सूअर|सुअर|हिजड़ा|हिजड़े|हिजडा|हिजडे)";
const insults =
  "(बेवकूफ़|बेवकूफ|मूर्ख|मूरख|कमीना|कमीने|कमीनी|घटिया|नालायक|निकम्मा|निकम्मे|निकम्मी|हरामी|जाहिल|गंवार|चूतिया|चुतिया|नीच|हरामखोर|कुतिया)";

const harassment: ModerationRule[] = [
  {
    id: "hi.harassment.family-insult",
    pattern:
      "(तेरी|तेरे|तेरा|तुम्हारी|तुम्हारे|उसकी|उसके|इसकी) (मां|मा|माई|मैया|बहन|बहिन|बेहन|बेटी) (का|की|के|को) (भोसड़ा|भोसडा|भोसड़ी|भोसडी|चूत|चुत|लंड|लौड़ा|लौडा)",
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
  },
  {
    id: "hi.harassment.family-abuse",
    pattern: "(मां|बहन|बहिन|बेटी) (को|की)? (चोद*|चुद*)",
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
  },
  {
    id: "hi.harassment.insult",
    pattern: `${you} ${degree} ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "hi.harassment.insult-animal",
    pattern: `${you} ${degree} ${animals} (है|हो|हैं)`,
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "insult",
  },
  {
    // Only "aulad" (offspring): "kutte ka baccha" is also a puppy.
    id: "hi.harassment.animal-offspring",
    pattern: "(कुत्ते|कुत्ता|सूअर|सुअर|गधे|हरामखोर) (की|का|के) (औलाद|औलादें)",
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "insult",
  },
  {
    // Needs the imperative ending: "aatmahatya kar li" (past tense) is news.
    id: "hi.harassment.self-harm",
    pattern: "(खुदकुशी|ख़ुदकुशी|आत्महत्या) (कर|करो) (ले|लो)",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "hi.harassment.self-harm-joined",
    pattern: "(खुदकुशी|ख़ुदकुशी|आत्महत्या) (करले|करलो)",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "hi.harassment.self-harm-hang",
    pattern: "(फांसी|फंदा) (लगा|लगाकर) (ले|लो|मर|मरो)",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "hi.harassment.go-die",
    pattern: "(मर|डूब) (जा|जाओ|मर|मरो)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "hostility",
  },
  {
    id: "hi.harassment.threat",
    pattern: "(तुझे|तुम्हें|तुम्हे|तुमको|तुझको) (जान)? (से)? (मार|काट|खत्म|ख़त्म|जला) (कर)? (दूंगा|दूंगी|डालूंगा|डालूंगी|देंगे|डालेंगे)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
];

// Threats and abusive address, as in the Hinglish pack. A bare "साले" (brother-in-law) is fine.
const threats: ModerationRule[] = [
  {
    // "ghar mein ghus ke maarunga" (breaking into your home)
    id: "hi.harassment.home-invasion",
    pattern: "घर (में|मे|पे|पर|तक)? (घुस|घुसके|घुसकर|आके|आकर|आ) (के|कर)? (मार*|चोद*|काट*|तोड़*|तोड*|पीट*|जला*|उठवा*|फोड़*)",
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "threat",
  },
  {
    // "tujhe maarunga", "tujhe chodunga"
    id: "hi.harassment.threat-short",
    pattern: "(तुझे|तुम्हें|तुम्हे|तुमको|तुझको|तेरे) (मारूंगा|मारुंगा|काटूंगा|पीटूंगा|तोड़ूंगा|चोदूंगा|चोदुंगा|जलाऊंगा)",
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "threat",
  },
  {
    // "tujhe nahin chhodunga" (I won't spare you)
    id: "hi.harassment.wont-spare",
    pattern: "(तुझे|तुम्हें|तुम्हे|तुमको|तुझको) (तो)? (नहीं|नही) (छोड़ूंगा|छोडूंगा|छोड़ेंगे|छोडेंगे|बख्शूंगा|बचेगा)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "threat",
  },
  {
    id: "hi.harassment.abusive-address",
    pattern: "(अबे|ओए|ओये) (साले|साला|साली|कुत्ते|कमीने|हरामी)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "insult",
  },
  {
    id: "hi.harassment.saale-insult",
    pattern: "(साले|साला|साली) (कुत्ते|कुत्ता|कमीने|कमीना|हरामी|चूतिये|चूतिया|गांडू|भड़वे|सूअर|उल्लू)",
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
];

// Gaali aimed at a person is masked as profanity AND warned about as an insult, as in the Hinglish pack.
const gaali: ModerationRule[] = [
  {
    id: "hi.harassment.gaali",
    pattern: "(भोसड*|भोसरी*|हरामी|हरामज़ाद*|हरामजाद*|हरामखोर*|हरामख़ोर*|लोडू|लौड़ू|लोड़ू)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "insult",
  },
];

const sexual: ModerationRule[] = [
  { id: "hi.sexual.porn", pattern: "(पोर्न|पॉर्न)", category: "sexual", severity: "medium", confidence: 0.85, label: "sexual-content" },
  {
    id: "hi.sexual.nudes-request",
    pattern: "(नंगी|नंगा) (फोटो|फ़ोटो|तस्वीर|वीडियो|पिक) (भेज*|दिखा*)",
    category: "sexual",
    severity: "high",
    confidence: 0.85,
    label: "solicitation",
  },
];

export const hi: DictionaryPack = {
  language: "hi",
  boundary: "word",
  rules: [...profanity, ...hate, ...harassment, ...threats, ...gaali, ...sexual],
  allowList: [],
};

export default hi;
