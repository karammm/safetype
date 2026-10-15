# Languages

| Language | Tag | Enabled |
| --- | --- | --- |
| English | `en` | ✅ by default |
| Hinglish (romanized Hindi) | `hi-Latn` | ✅ by default, with English |
| Hindi (Devanagari) | `hi` | opt-in |
| Spanish | `es` | opt-in |
| French | `fr` | opt-in |
| German | `de` | opt-in |
| Portuguese | `pt` | opt-in |

```ts
createModerationEngine(); // English + Hinglish
createModerationEngine({ languages: ["en"] }); // English only
createModerationEngine({ languages: ["en", "es", "fr"] }); // several languages
createModerationEngine({ language: "pt-BR" }); // a region tag uses the base pack
createModerationEngine({ language: "hi" }); // Hindi in both scripts
createModerationEngine({ language: "hi-Latn" }); // Hinglish only
```

The same options work everywhere: `createSafeType({ languages })`, the React, Vue and Angular bindings,
the editor, the adapters, and Python (`languages=["en", "es"]`).

## What each pack covers

- **Profanity:** common swear words and their usual spellings.
- **Hate:** a short list of slurs with no common innocent meaning, plus statements calling for violence against
  a group ("… deberían morir", "… sollten vergast werden").
- **Harassment:** insults aimed at the reader ("eres un idiota", "du bist so ein Idiot", "तू बेवकूफ है"),
  threats, and self-harm incitement.

## Avoiding false positives

Each pack leaves out words that are also ordinary words, and lists them at the top of its source file. For example:

| Pack | Left out | Because |
| --- | --- | --- |
| `es` | coño | Accents are ignored, so it would match "cono" (cone) |
| `fr` | con, bite | "pros and cons", "to bite" |
| `de` | Mist, schlampig | "mist", "sloppy" |
| `pt` | cu, veado, bicha | "see you", "deer", "queue" in Portugal |
| `hi` | साला, लोड, कटवा | "brother-in-law", "load", "got it cut" |

Some insults are only insults in direct address. "Hund" (dog) is flagged in "du Hund" but not in
"Ihr Hund ist süß". Every pack has a test suite of everyday sentences that must stay clean.

## Hindi in Devanagari

Vowel signs, the virama and the nukta are part of Hindi spelling, so SafeType keeps them. "लंड" is never
confused with "लड़" (fight), and "चोद" is never confused with "चौदह" (fourteen). Candrabindu and anusvara count as
the same ("माँ" = "मां"). Masking replaces whole characters, never leaving a floating vowel sign:

```ts
createModerationEngine({ language: "hi" }).moderate("तू चूतिया है").text; // "तू चू*या है"
```

## Improve a language

The packs were written and tested carefully, but native speakers know best. Corrections and new languages are
welcome. See [adding a language](https://github.com/karammm/safetype/blob/main/CONTRIBUTING.md#adding-a-language),
or [report a missed word or a false positive](https://github.com/karammm/safetype/issues/new/choose).
