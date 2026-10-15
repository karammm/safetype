import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * German. Opt-in: `languages: ["de"]` or `languages: ["en", "de"]`.
 *
 * "ß" matches "ss" and umlauts match their plain vowel ("Scheiße" = "Scheisse", "Arschlöcher" =
 * "Arschlocher"); the "ae/oe/ue" spellings are listed explicitly. Left out because they are
 * ordinary words: "Mist" (also English), "schlampig" (sloppy), "Zigeuner" (in historical names),
 * and a bare "fick*" prefix (English "fickle"). Animal words ("Hund", "Schwein", "Kuh", "Affe")
 * and "Opfer" are only insults in direct address ("du Opfer"), which the harassment rules cover.
 *
 * Austria and Switzerland: "Oaschloch", "Gschissener", "Beidl", "Huerebueb" and "Hueresiech" are
 * included. A bare Swiss "huere" is not: it is also an intensifier ("huere guet", really good).
 * "Spast" and "Mongo" are harassment when aimed at someone, like "retard" in English; a bare
 * "Mongo" is also MongoDB.
 */

const profanity: ModerationRule[] = [
  { id: "de.profanity.scheisse", pattern: "(scheiss*|scheis)", category: "profanity", severity: "medium", replacement: "Mist" },
  { id: "de.profanity.arsch", pattern: "arsch", category: "profanity", severity: "medium" },
  {
    id: "de.profanity.arschloch",
    pattern: "(arschloch*|arschloech*|arschgeige*|arschgesicht*|arschkriecher*|arschficker*)",
    category: "profanity",
    severity: "high",
  },
  { id: "de.profanity.fotze", pattern: "fotze*", category: "profanity", severity: "critical" },
  {
    id: "de.profanity.ficken",
    pattern: "(fick|ficke|fickt|ficken|fickst|fickte|ficktest|gefickt|ficker|fickers|fickdich)",
    category: "profanity",
    severity: "high",
  },
  { id: "de.profanity.wichser", pattern: "(wichser*|wichse|wichsen|wichst|wixer*|wixxer*)", category: "profanity", severity: "high" },
  { id: "de.profanity.hurensohn", pattern: "(hurensohn*|hurensoehne*|hurenkind*|hurenbock*)", category: "profanity", severity: "high" },
  { id: "de.profanity.hure", pattern: "(hure|huren)", category: "profanity", severity: "high" },
  { id: "de.profanity.schlampe", pattern: "(schlampe|schlampen)", category: "profanity", severity: "high" },
  { id: "de.profanity.miststueck", pattern: "(miststuck*|miststueck*|mistkerl*|mistsau)", category: "profanity", severity: "high" },
  { id: "de.profanity.verpiss", pattern: "verpiss*", category: "profanity", severity: "high" },
  { id: "de.profanity.leck-mich", pattern: "leck mich", category: "profanity", severity: "medium" },
  { id: "de.profanity.kacke", pattern: "(kacke|kack|kacken|kackbratze*|kackscheiss*)", category: "profanity", severity: "medium" },
  { id: "de.profanity.oasch", pattern: "(oasch|oaschloch*|oaschgeige*|oaschkriecher*)", category: "profanity", severity: "high" },
  { id: "de.profanity.gschissen", pattern: "(gschissen*|gschissana|gschissane)", category: "profanity", severity: "medium" },
  { id: "de.profanity.beidl", pattern: "(beidl|beidln|beidlwappler*)", category: "profanity", severity: "medium" },
  { id: "de.profanity.huere", pattern: "(huerebueb*|huerechaib*|hueresiech*|huereseich|huerefotze*)", category: "profanity", severity: "high" },
  { id: "de.profanity.pisser", pattern: "(pisser|pissnelke*)", category: "profanity", severity: "medium" },
  {
    id: "de.profanity.dreck",
    pattern: "(drecksau*|dreckschwein*|drecksack*|dreckstuck*|dreckstueck*|drecksfotze*)",
    category: "profanity",
    severity: "high",
  },
  { id: "de.profanity.schwanzlutscher", pattern: "(schwanzlutscher*|pimmel|pimmelkopf*)", category: "profanity", severity: "high" },
];

const hate: ModerationRule[] = [
  // A deliberately small list of slurs with no common benign meaning.
  ...["(kanake*|kanacke*)", "(neger|negers|negerin*)", "schwuchtel*", "(kummelturke*|kuemmeltuerke*)", "judensau*"].map(
    (pattern): ModerationRule => ({
      id: `de.hate.slur.${pattern.replace(/[()*]/g, "").split("|")[0]}`,
      pattern,
      category: "hate",
      severity: "critical",
      confidence: 0.9,
      label: "slur",
    }),
  ),
  {
    id: "de.hate.group-violence",
    pattern:
      "(juden|muslime|moslems|christen|auslander|auslaender|fluchtlinge|fluechtlinge|migranten|asylanten|schwarze|turken|tuerken|araber|schwule|lesben|frauen|roma|sinti|kanaken) (sollten|sollen|mussen|muessen|gehoren|gehoeren|verdienen) (alle)? (es)? (zu)? (sterben|brennen|vergast|vernichtet|ausgerottet|erschossen|aufgehangt|aufgehaengt|abgeschlachtet|verbrannt|tot)",
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
];

const insults =
  "(idiot*|vollidiot*|depp*|trottel*|arschloch*|wichser*|dumm|dummkopf*|blod|bloed|behindert*|spast*|mongo|missgeburt*|versager*|loser*|penner*|hurensohn*|witzfigur*|lappen|opfer|abschaum|mull|muell|nichtsnutz*|hackfresse*|schwachkopf*|schwachmat*|pisser|bastard*|hund|schwein|sau|kuh|ziege|affe|esel|ratte|made|wappler|oaschloch*|gschissener|spacko|spacken|schlampe|fotze|hure|spasti)";

const degree =
  "(so|echt|total|voll|wirklich|einfach)? (ein|eine|einer|n)? (verdammter|verdammte|verdammtes|dummer|dumme|dummes|blode|bloede|bloder|bloeder|blodes|bloedes|alte|alter|altes|kleiner|kleine|kleines|elender|elendes|scheiss)?";

const harassment: ModerationRule[] = [
  {
    // Without a verb only "du" is direct address: "Ihr Hund" is "your dog".
    id: "de.harassment.insult",
    pattern: `du (bist)? ${degree} ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "de.harassment.insult-formal",
    pattern: `(sie|ihr) (sind|seid) ${degree} ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "de.harassment.self-harm",
    pattern: "(bring|bringt|bringen) (dich|euch|sich) (doch|endlich)? um",
    category: "harassment",
    severity: "critical",
    confidence: 0.9,
    label: "self-harm-incitement",
  },
  {
    id: "de.harassment.self-harm-hang",
    // "haeng dich rein" (give it your all) is encouragement, so "haeng dich" needs "auf".
    pattern: "(erhang|erhaeng|toete|tote) (dich|euch)",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "de.harassment.self-harm-hang-up",
    pattern: "(hang|haeng) (dich|euch) auf",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    id: "de.harassment.go-die",
    pattern: "(geh|geht) (sterben|verrecken|krepieren)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "hostility",
  },
  {
    id: "de.harassment.threat",
    pattern: "(ich|wir) (werde|werden|will|wollen)? (dich|euch) (umbringen|toten|toeten|abstechen|erschiessen|abknallen|kaltmachen|abmurksen)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "de.harassment.threat-bring-um",
    pattern: "(ich|wir) (bringe|bring|bringen) (dich|euch) um",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "de.harassment.nobody-likes",
    pattern: "(niemand|keiner) (mag|liebt|will|braucht) (dich|euch)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "exclusion",
  },
];

export const de: DictionaryPack = {
  language: "de",
  boundary: "word",
  rules: [...profanity, ...hate, ...harassment],
  allowList: [],
};

export default de;
