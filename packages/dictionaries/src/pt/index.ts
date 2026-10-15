import type { DictionaryPack, ModerationRule } from "@safetype/shared";

/*
 * Portuguese (Brazil and Portugal). Opt-in: `languages: ["pt"]` or `languages: ["en", "pt"]`.
 *
 * Accents are optional when matching ("cuzão" = "cuzao"). Left out because they are ordinary words:
 * a bare "cu" (also English "see you"), "pica" (it stings), "rola" (it rolls), "veado" (deer),
 * "bicha" (queue in Portugal), "piranha" (the fish), "macaco" (monkey), "crioulo" (Creole).
 * "cu" is still caught in phrases ("no cu", "vai tomar no cu"). Also left out: "puto" (a kid in
 * Portugal, "angry" in Brazil) and "fds" (foda-se in Portugal, but "fim de semana", weekend, in Brazil).
 *
 * Portugal: "cona", "cabrão", "badalhoco" and the slur "paneleiro" are included.
 */

const profanity: ModerationRule[] = [
  { id: "pt.profanity.porra", pattern: "(porra|porras)", category: "profanity", severity: "medium" },
  { id: "pt.profanity.caralho", pattern: "(caralho*|caraio|krl|crl)", category: "profanity", severity: "high" },
  {
    id: "pt.profanity.foder",
    pattern: "(foda|fodas|fodase|fodasse|foder|fodido*|fodida*|fodendo|fode|fodeu|fodam|fuder|fudido*|fudida*|fudeu|fudendo)",
    category: "profanity",
    severity: "high",
  },
  { id: "pt.profanity.puta", pattern: "(puta|putas|putaria*|putinha*)", category: "profanity", severity: "high" },
  { id: "pt.profanity.abbreviations", pattern: "(fdp|vtnc|vtmnc|tmnc|vsf|vsfd|pqp|tnc|pnc)", category: "profanity", severity: "high" },
  { id: "pt.profanity.cona", pattern: "(cona|conas)", category: "profanity", severity: "high" },
  { id: "pt.profanity.cabrao", pattern: "(cabrao|cabroes|cabrona|cabronas)", category: "profanity", severity: "high" },
  { id: "pt.profanity.badalhoco", pattern: "(badalhoc*)", category: "profanity", severity: "medium" },
  { id: "pt.profanity.merda", pattern: "merda*", category: "profanity", severity: "medium" },
  { id: "pt.profanity.buceta", pattern: "(buceta*|boceta*|xoxota*|xereca*)", category: "profanity", severity: "high" },
  { id: "pt.profanity.cu", pattern: "(no|do|teu|seu|meu|nosso) cu", category: "profanity", severity: "medium" },
  { id: "pt.profanity.cuzao", pattern: "(cuzao|cuzinho|cuzona)", category: "profanity", severity: "high" },
  { id: "pt.profanity.arrombado", pattern: "(arrombad*)", category: "profanity", severity: "high" },
  { id: "pt.profanity.piroca", pattern: "(piroca*|pirocudo*)", category: "profanity", severity: "high" },
  { id: "pt.profanity.cacete", pattern: "cacete*", category: "profanity", severity: "medium" },
  { id: "pt.profanity.bosta", pattern: "bosta*", category: "profanity", severity: "medium" },
  { id: "pt.profanity.vadia", pattern: "(vadia|vadias)", category: "profanity", severity: "high" },
  { id: "pt.profanity.desgracado", pattern: "(desgracad*)", category: "profanity", severity: "medium" },
];

const hate: ModerationRule[] = [
  // A deliberately small list of slurs with no common benign meaning.
  ...["(viado|viados|viadinho*|viadao)", "(sapatao|sapatoes|sapatona*)", "(traveco|travecos)", "(paneleiro|paneleiros|paneleira|paneleiras|paneleirice)"].map(
    (pattern): ModerationRule => ({
      id: `pt.hate.slur.${pattern.replace(/[()*]/g, "").split("|")[0]}`,
      pattern,
      category: "hate",
      severity: "critical",
      confidence: 0.9,
      label: "slur",
    }),
  ),
  {
    id: "pt.hate.group-violence",
    pattern:
      "(judeus|muculmanos|cristaos|negros|pretos|brancos|gays|viados|lesbicas|trans|mulheres|imigrantes|nordestinos|indios|refugiados|ciganos|baianos|africanos|arabes) (deveriam|devem|merecem|tem|teem) (que|de)? (ser)? (morrer|queimar|exterminados|exterminadas|mortos|mortas|queimados|queimadas|eliminados|eliminadas|enforcados|fuzilados)",
    category: "hate",
    severity: "critical",
    confidence: 0.8,
    label: "dehumanizing",
  },
];

const insults =
  "(idiota*|imbecil*|burro|burra|estupido*|estupida*|otario*|otaria*|babaca*|lixo|inutil|retardado*|retardada*|mongoloide*|debil|corno*|vagabundo*|vagabunda*|nojento*|nojenta*|patetico*|patetica*|fracassado*|fracassada*|palhaco*|escroto*|escrota*|merda|cabrao|paneleiro|puto|arrombado*|arrombada*|desgracado*|desgracada*|vadia|puta|piranha|cachorra)";

const harassment: ModerationRule[] = [
  {
    id: "pt.harassment.insult",
    pattern: `(voce|vc|tu) (e|eh|es)? (um|uma)? (grande|completo|completa|puta|baita|bela|belo|maior)? ${insults}`,
    category: "harassment",
    severity: "medium",
    confidence: 0.8,
    label: "insult",
  },
  {
    id: "pt.harassment.self-harm",
    pattern: "(vai|va) se (matar|enforcar|suicidar)",
    category: "harassment",
    severity: "critical",
    confidence: 0.9,
    label: "self-harm-incitement",
  },
  {
    id: "pt.harassment.self-harm-imperative",
    pattern: "(mate|enforque|suicide) se",
    category: "harassment",
    severity: "critical",
    confidence: 0.85,
    label: "self-harm-incitement",
  },
  {
    // A bare "morre" is also news ("morre aos 80 anos"), so only with an insult or "logo".
    id: "pt.harassment.go-die",
    pattern: "(morre|morra|morram) (logo|desgracado|desgracada|lixo|seu|sua|maldito|maldita)",
    category: "harassment",
    severity: "high",
    confidence: 0.75,
    label: "hostility",
  },
  {
    id: "pt.harassment.threat",
    pattern: "(vou|vamos|irei) te (matar|esfaquear|furar|apagar|quebrar|encher)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "pt.harassment.threat-short",
    pattern: "te (mato|matarei)",
    category: "harassment",
    severity: "high",
    confidence: 0.7,
    label: "threat",
  },
  {
    id: "pt.harassment.nobody-likes",
    pattern: "ninguem (gosta|liga|quer|suporta|aguenta) (de)? (voce|vc|ti)",
    category: "harassment",
    severity: "medium",
    confidence: 0.75,
    label: "exclusion",
  },
];

export const pt: DictionaryPack = {
  language: "pt",
  boundary: "word",
  rules: [...profanity, ...hate, ...harassment],
  allowList: [],
};

export default pt;
