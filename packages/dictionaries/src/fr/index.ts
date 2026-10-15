import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * French. Opt-in: `languages: ["fr"]` or `languages: ["en", "fr"]`.
 *
 * Accents are optional when matching ("enculé" = "encule"). Left out because they are ordinary
 * words, in French or in English text next to it: "con" (pros and cons), "bite" (to bite),
 * "chienne" (female dog), "niké" (the brand), "pédé" (normalizes to "pede", Portuguese for "asks").
 * "con", "conne" and "chienne" are still caught in direct-address phrases ("t'es con", "sale con").
 * Known collision: "bâtard" is also a type of bread.
 */

const profanity: ModerationRule[] = [
  { id: "fr.profanity.merde", pattern: "(merde*|merdique*|emmerd*)", category: "profanity", severity: "medium", replacement: "zut" },
  { id: "fr.profanity.putain", pattern: "(putain*|ptn)", category: "profanity", severity: "medium", replacement: "zut" },
  { id: "fr.profanity.pute", pattern: "(pute|putes)", category: "profanity", severity: "high" },
  { id: "fr.profanity.connard", pattern: "(connard*|connasse*|conasse*|conard*)", category: "profanity", severity: "high" },
  { id: "fr.profanity.salope", pattern: "(salope*|salaud*|salopard*)", category: "profanity", severity: "high" },
  { id: "fr.profanity.encule", pattern: "encul*", category: "profanity", severity: "high" },
  { id: "fr.profanity.niquer", pattern: "(nique|niquer|niquez|niques|niquee)", category: "profanity", severity: "high" },
  { id: "fr.profanity.couille", pattern: "(couille*|couillon*)", category: "profanity", severity: "medium" },
  { id: "fr.profanity.enfoire", pattern: "enfoire*", category: "profanity", severity: "high" },
  { id: "fr.profanity.batard", pattern: "batard*", category: "profanity", severity: "high" },
  { id: "fr.profanity.branleur", pattern: "(branleur*|branleuse*|branlette*)", category: "profanity", severity: "medium" },
  { id: "fr.profanity.pouffiasse", pattern: "(pouffiasse*|poufiasse*|petasse*)", category: "profanity", severity: "high" },
  { id: "fr.profanity.trou-du-cul", pattern: "trou (du|de) cul", category: "profanity", severity: "high" },
  { id: "fr.profanity.bordel", pattern: "bordel", category: "profanity", severity: "low" },
  { id: "fr.profanity.chier", pattern: "(chier|chiant|chiante|chiants|chiantes|chiasse)", category: "profanity", severity: "low" },
];

const hate: ModerationRule[] = [
  // A deliberately small list of slurs with no common benign meaning.
  ...["(bougnoul*|bougnoule*)", "(youpin*|youtre*)", "(negre|negres|negresse*)", "bamboula*", "(tafiole*|tarlouze*|tantouze*)"].map(
    (pattern): ModerationRule => ({
      id: `fr.hate.slur.${pattern.replace(/[()*]/g, "").split("|")[0]}`,
      pattern,
      category: "hate",
      severity: "critical",
      confidence: 0.9,
      label: "slur",
    }),
  ),
  {
    id: "fr.hate.group-violence",
    pattern:
      "(juifs|musulmans|chretiens|noirs|blancs|arabes|immigres|migrants|refugies|gays|homos|lesbiennes|trans|femmes|africains|asiatiques|roms|gitans) (doivent|devraient|meritent) (d|de)? (etre)? (mourir|crever|bruler|extermines|gazes|brules|tues|pendus|eradiques|massacres)",
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
];

const insults =
  "(idiot*|imbecile*|debile*|abruti*|cretin*|con|conne|connard*|connasse*|nul|nulle|minable*|pathetique*|attarde*|mongol|mongole|batard*|salope|ordure*|merde|dechet*|rate|ratee|loser*|bouffon*|clown*|stupide*|chienne|grosse|moche|pute)";

const harassment: ModerationRule[] = [
  {
    id: "fr.harassment.insult",
    pattern: `(tu|t|vous) (es|etes) (vraiment|trop|qu)? (un|une)? (sale|gros|grosse|pauvre|petit|petite|vrai|vraie)? ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "fr.harassment.sale",
    pattern: "(espece|sale) (de)? (con|conne|connard*|connasse*|pute|chienne|batard*|merde|ordure*|race|arabe|noir|juif)",
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "fr.harassment.family",
    pattern: "(nique|niquer|baise) (ta|sa|vos|votre) (mere|race|soeur|famille|daronne)",
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
  },
  {
    id: "fr.harassment.go-away",
    pattern: "(va|allez) (te|vous) faire (foutre|enculer|niquer|voir)",
    category: "harassment",
    severity: "high",
    confidence: 0.8,
    label: "hostility",
  },
  {
    id: "fr.harassment.shut-up",
    pattern: "ta gueule",
    category: "harassment",
    severity: "low",
    confidence: 0.7,
    label: "hostility",
  },
  {
    id: "fr.harassment.self-harm",
    pattern: "(va|vas|allez) (te|vous) (pendre|suicider|tuer)",
    category: "harassment",
    severity: "critical",
    confidence: 0.9,
    label: "self-harm-incitement",
  },
  {
    id: "fr.harassment.self-harm-imperative",
    pattern: "(suicide|tue|pends) (toi)",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "fr.harassment.go-die",
    pattern: "(va|vas|allez) (crever|mourir)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "hostility",
  },
  {
    id: "fr.harassment.threat",
    pattern: "(je|j) (vais|v)? (te|vous|t) (tuer|buter|planter|defoncer|tabasser|egorger|tue|bute|plante|defonce|egorge)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "fr.harassment.nobody-likes",
    pattern: "personne ne (t|te|vous) (aime|supporte|veut|apprecie)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "exclusion",
  },
];

export const fr: DictionaryPack = {
  language: "fr",
  boundary: "word",
  rules: [...profanity, ...hate, ...harassment],
  allowList: [],
};

export default fr;
