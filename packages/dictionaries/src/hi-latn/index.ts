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
 * Devanagari script is planned for the full Hindi pack.
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
  { id: "hi-latn.profanity.kutiya", pattern: "(kutiya|kuttiya|kutiyaa)", category: "profanity", severity: "high" },
];

// Abuse aimed at someone's family ("teri maa ka bhosada") is targeted harassment, not just a swear word.
const family = "(teri|tere|tera|tumhari|tumhara|tumhare|uski|uske|iski|apni)";
const relative = "(maa|ma|mai|behen|bahen|behan|bahan|bhen|beti)";

const harassment: ModerationRule[] = [
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
  rules: [...profanity, ...harassment, ...insults, ...sexual],
  allowList: [],
};

export default hiLatn;
