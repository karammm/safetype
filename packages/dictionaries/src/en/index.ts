import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * English pack.
 *
 * Profanity is deterministic: these words are offensive almost regardless of context, so they
 * carry full confidence and can be masked safely.
 *
 * Hate and harassment rules are *signals*, not verdicts. They carry lower confidence, and
 * the engine lowers it further for quoted or mentioned text, so borderline matches
 * surface as `requiresReview` instead of being acted on automatically. Dictionary rules alone
 * cannot reliably detect hate speech; pair them with a contextual classifier and server review.
 */

const profanity: ModerationRule[] = [
  { id: "en.profanity.fuck", pattern: "fuck*", category: "profanity", severity: "high", replacement: "heck" },
  { id: "en.profanity.motherfucker", pattern: "motherfuck*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.shit", pattern: "shit*", category: "profanity", severity: "medium", replacement: "shoot" },
  { id: "en.profanity.bullshit", pattern: "(bullshit*|horseshit*)", category: "profanity", severity: "medium", replacement: "nonsense" },
  { id: "en.profanity.bitch", pattern: "bitch*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.ass", pattern: "(ass|arse)", category: "profanity", severity: "medium", replacement: "butt" },
  { id: "en.profanity.asshole", pattern: "(asshole*|arsehole*|jackass*|dumbass*)", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.bastard", pattern: "bastard*", category: "profanity", severity: "medium", replacement: "jerk" },
  { id: "en.profanity.cunt", pattern: "cunt*", category: "profanity", severity: "critical", replacement: "jerk" },
  { id: "en.profanity.dickhead", pattern: "dickhead*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.cocksucker", pattern: "cocksuck*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.wanker", pattern: "wank*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.twat", pattern: "twat*", category: "profanity", severity: "high", replacement: "jerk" },
  { id: "en.profanity.slut", pattern: "slut*", category: "profanity", severity: "high" },
  { id: "en.profanity.whore", pattern: "whore*", category: "profanity", severity: "high" },
  { id: "en.profanity.douche", pattern: "douche*", category: "profanity", severity: "medium", replacement: "jerk" },
  { id: "en.profanity.bollocks", pattern: "bollocks", category: "profanity", severity: "medium", replacement: "nonsense" },
  { id: "en.profanity.piss", pattern: "(piss|pisses|pissing)", category: "profanity", severity: "medium" },
  { id: "en.profanity.pissed", pattern: "pissed", category: "profanity", severity: "low", replacement: "annoyed" },
  { id: "en.profanity.damn", pattern: "(damn*|goddamn*)", category: "profanity", severity: "low", replacement: "darn" },
  { id: "en.profanity.crap", pattern: "crap*", category: "profanity", severity: "low", replacement: "junk" },
];

const hate: ModerationRule[] = [
  // A deliberately small list of slurs with no common benign meaning.
  ...["nigger*", "faggot*", "kike*", "wetback*", "raghead*", "towelhead*"].map(
    (pattern): ModerationRule => ({
      id: `en.hate.slur.${pattern.replace("*", "")}`,
      pattern,
      category: "hate",
      severity: "critical",
      confidence: 0.9,
      label: "slur",
    }),
  ),
  {
    id: "en.hate.group-violence",
    pattern:
      "(jews|muslims|christians|blacks|whites|asians|mexicans|immigrants|gays|lesbians|trans|women|arabs|africans|hindus|sikhs|refugees) (should|must|need|deserve) (to)? (be)? (die|burn|hang|rot|killed|exterminated|gassed|eradicated)",
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
];

const insults =
  "(idiot*|moron*|stupid|dumb|loser*|worthless|pathetic|ugly|imbecile*|retard*|trash|garbage|scum|disgusting|failure|freak|clown)";

const harassment: ModerationRule[] = [
  {
    id: "en.harassment.insult",
    pattern: `(you|u|ur|youre|yall) (are|re|r)? (such)? (a|an)? (so|fucking|complete|total|absolute)? ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
    replacement: "I disagree with you",
  },
  {
    id: "en.harassment.piece-of",
    pattern: "(you|u|ur|youre) (are|re|r)? (a)? piece of (shit|crap|garbage|trash)",
    category: "harassment",
    severity: "high",
    confidence: 0.85,
    label: "insult",
    replacement: "I disagree with you",
  },
  {
    id: "en.harassment.you-suck",
    pattern: "(you|u) (suck|stink)",
    category: "harassment",
    severity: "low",
    confidence: 0.7,
    label: "insult",
  },
  {
    id: "en.harassment.self-harm",
    pattern: "(kill|hang) (yourself|urself|yourselves)",
    category: "harassment",
    severity: "critical",
    confidence: 0.9,
    label: "self-harm-incitement",
  },
  {
    id: "en.harassment.kys",
    pattern: "kys",
    category: "harassment",
    severity: "critical",
    confidence: 0.8,
    label: "self-harm-incitement",
  },
  {
    id: "en.harassment.go-die",
    pattern: "go (die|rot)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "hostility",
  },
  {
    id: "en.harassment.threat",
    pattern: "(i|ill|imma|im) (ll|will|am|m|gonna)? (going)? (to)? (kill|murder|hurt|stab|shoot) (you|u)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "en.harassment.nobody-likes",
    pattern: "(nobody|noone) (likes|loves|cares|wants) (about)? (you|u)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "exclusion",
  },
];

export const en: DictionaryPack = {
  language: "en",
  boundary: "word",
  rules: [...profanity, ...hate, ...harassment],
  allowList: ["shiitake", "shitake"],
};

export default en;
