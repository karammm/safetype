import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * Hinglish: Hindi/Urdu profanity written in Latin script, as it is typed in chats, comments and DMs.
 * Enabled by default next to English (`languages: ["en", "hi-Latn"]`).
 *
 * Spelling is not standardised, so rules list the common variants; repeated letters ("bhenchoddd") and
 * leet ("bh3nchod") are handled by the engine. Deliberately NOT included because they collide with
 * ordinary words or names: "bc" / "mc" (BC, master of ceremonies), "bkc" (Bandra Kurla Complex),
 * "kutti" (child in Tamil/Malayalam), bare "randi" (a given name), "gand" (Ghent).
 * Known remaining collisions: "Lund" (Swedish city / surname), "Lauda" (surname), "chut" (French "hush").
 * Devanagari script is in the `hi` pack.
 */

const profanity: ModerationRule[] = [
  {
    id: "hi-latn.profanity.behenchod",
    pattern: "(behenchod*|behanchod*|bahenchod*|bahanchod*|bhenchod*|bhanchod*|benchod*|bhenchud*|behenchood*|bhencho|behencho)",
    category: "profanity",
    severity: "high",
  },
  {
    id: "hi-latn.profanity.madarchod",
    pattern: "(madarchod*|maderchod*|madharchod*|maadarchod*|madarchood*|madrchod*|maderjaat|madarjaat)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi-latn.profanity.betichod", pattern: "(betichod*|betichood*)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.beti-chod", pattern: "beti (chod*|chood*)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.chut", pattern: "(chut|choot|chuth|chooth)", category: "profanity", severity: "high" },
  {
    id: "hi-latn.profanity.loda",
    pattern: "(loda|lauda|lavda|lawda|laude|lavde|lawde|laudu|lavdu|lund|lundd)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi-latn.profanity.lodu", pattern: "(lodu|lodoo|loduchand|lodus)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.bhosda", pattern: "(bhosd*|bhosad*|bhosid*|bhosri*|bhosdk)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.abbreviations", pattern: "(bsdk|bkl|mkc)", category: "profanity", severity: "high" },
  {
    id: "hi-latn.profanity.chutiya",
    pattern: "(chutiya*|chutiye*|chutia*|chootiya*|chutya*|chutiye)",
    category: "profanity",
    severity: "high",
  },
  { id: "hi-latn.profanity.gandu", pattern: "(gandu|gaandu|gandoo|gaandoo|gaand*)", category: "profanity", severity: "medium" },
  { id: "hi-latn.profanity.randi", pattern: "(randiya|randwa|randibaaz*|randibaz*|randikhana)", category: "profanity", severity: "high" },
  {
    id: "hi-latn.profanity.harami",
    pattern: "(harami|haraami|haramkhor*|haraamkhor*|haramzad*|haraamzad*|haramjad*)",
    category: "profanity",
    severity: "medium",
  },
  { id: "hi-latn.profanity.bhadwa", pattern: "(bhadwa|bhadwe|bhadva|bhadve|bhadwi|bhadwaa)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.jhaatu", pattern: "(jhaat*|jhant*|jhaant*)", category: "profanity", severity: "medium" },
  { id: "hi-latn.profanity.chhinal", pattern: "(chhinal|chinal|chhinaal|chinaal|chhinar|chinar)", category: "profanity", severity: "high" },
  { id: "hi-latn.profanity.kutiya", pattern: "(kutiya|kuttiya|kutiyaa)", category: "profanity", severity: "high" },
];

// Abuse aimed at someone's family ("teri maa ka bhosada") is targeted harassment, not just a swear word.
const family = "(teri|tere|tera|tumhari|tumhara|tumhare|uski|uske|iski|apni)";
const relative = "(maa|ma|mai|behen|bahen|behan|bahan|bhen|beti)";

const harassment: ModerationRule[] = [
  {
    // Only "aulad" (offspring): "kutte ka baccha" is also a puppy.
    id: "hi-latn.harassment.animal-offspring",
    pattern: "(kutte|kutta|kuttey|suar|suwar|gadhe|haramkhor) (ki|ka|ke) (aulad|aulaad|olad|olaad)",
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "hi-latn.harassment.family-insult",
    pattern: `${family} ${relative} (ka|ki|ke|ko) (bhosd*|bhosad*|chut|choot|lund|loda|lauda|lavda|lawda)`,
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
  },
  {
    // "chod" alone is too ambiguous (it is also a common spelling of "chhod", leave), so only with a relative.
    id: "hi-latn.harassment.family-abuse",
    pattern: `${relative} (ko|ki)? (chod*|chud*|chood*)`,
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
  },
];

/*
 * Threats. "chodunga" alone is not flagged (it is also a common spelling of "chhodunga", I'll leave), and neither is
 * "saale" (brother-in-law), so threats are recognized by their shape: breaking into someone's home, "tujhe … dunga",
 * "tujhe nahi chhodunga" (I won't spare you), and abusive address ("abe saale").
 */
const you = "(tujhe|tereko|tujhko|tumhe|tumko|tuje|tujko|tereko|aapko)";
const violent = "(chod*|maar*|mar*|kaat*|kat*|thok*|peet*|pit*|tod*|jala*|uthwa*|khatam|khatm|phod*)";

const threats: ModerationRule[] = [
  {
    // "ghar me ghus ke chodunga", "ghar aake maarunga"
    id: "hi-latn.harassment.home-invasion",
    pattern: `(ghar|gher) (me|mein|main|mai|mei|pe|par|tak)? (ghus|ghuske|ghuskar|ghusk|aake|aakar|aa|aake|aaunga|aunga) (ke|kar|k)? ${violent}`,
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "threat",
  },
  {
    // "tujhe maar dunga", "tujhe jaan se maar daalunga", "tujhe khatam kar dunga"
    id: "hi-latn.harassment.threat",
    pattern: `${you} (jaan)? (se)? (maar|mar|kaat|thok|peet|tod|jala|khatam|khatm|uthwa|gaad) (kar)? (dunga|daalunga|dalunga|denge|dalenge|daalenge|dungi|doonga|lunga|lenge)`,
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "threat",
  },
  {
    // "tujhe maarunga", "tujhe chodunga"
    id: "hi-latn.harassment.threat-short",
    pattern: `${you} (maarunga|marunga|maarenge|marenge|kaatunga|katunga|thokunga|peetunga|pitunga|todunga|chodunga|chodenge|chodega|jalaunga|phodunga)`,
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "threat",
  },
  {
    // "tujhe nahi chhodunga" (I won't spare you)
    id: "hi-latn.harassment.wont-spare",
    pattern: `${you} (to|toh)? (nahi|nhi|nai|nahin) (chhodunga|chodunga|chhodenge|chodenge|chhodungi|bakshunga|bakhshunga|bachega|bachegi)`,
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "threat",
  },
  {
    // "abe saale", "saale kutte"; a bare "saale" (brother-in-law) is fine
    id: "hi-latn.harassment.abusive-address",
    pattern: "(abe|abey|oye|oi|oyee) (saale|saala|saali|sale|kutte|kamine|kamini|harami)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "insult",
  },
  {
    id: "hi-latn.harassment.saale-insult",
    pattern: "(saale|saala|saali|sale) (kutte|kutta|kutti|kamine|kamina|harami|chutiye|chutiya|gandu|bhadwe|lodu|suar|suwar|haramkhor|ullu)",
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
];

// Gaali aimed at a person ("lodu", "harami", "bhosdike") is masked as profanity AND warned about as an insult.
const insults: ModerationRule[] = [
  {
    id: "hi-latn.harassment.gaali",
    pattern:
      "(bhosd*|bhosad*|bhosid*|bhosri*|lodu|lodoo|loduchand|lodus|harami|haraami|haramkhor*|haraamkhor*|haramzad*|haraamzad*|haramjad*)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "insult",
  },
];

const sexual: ModerationRule[] = [
  {
    // "nangi photo bhej" (send a nude photo)
    id: "hi-latn.sexual.nudes-request",
    pattern: "(nangi|nanga|nangii|nude|nudes) (photo|photos|pic|pics|video|videos|selfie|tasveer) (bhej*|dikha*|send|de|do)",
    category: "sexual",
    severity: "high",
    confidence: 0.85,
    label: "solicitation",
  },
];

export const hiLatn: DictionaryPack = {
  language: "hi-Latn",
  boundary: "word",
  rules: [...profanity, ...harassment, ...threats, ...insults, ...sexual],
  allowList: [],
};

export default hiLatn;
