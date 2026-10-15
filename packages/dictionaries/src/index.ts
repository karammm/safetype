import type { DictionaryPack } from "@safetype/shared";
import { de } from "./de/index";
import { en } from "./en/index";
import { es } from "./es/index";
import { fr } from "./fr/index";
import { hi } from "./hi/index";
import { hiLatn } from "./hi-latn/index";
import { pt } from "./pt/index";

export { de, en, es, fr, hi, hiLatn, pt };

/** Built-in packs keyed by lowercase language tag. Import a single pack (`@safetype/dictionaries/es`) to keep bundles small. */
export const packs: Readonly<Record<string, DictionaryPack>> = { en, "hi-latn": hiLatn, hi, es, fr, de, pt };

/** Languages enabled when an engine is created without `languages` or `packs`. */
export const DEFAULT_LANGUAGES: readonly string[] = ["en", "hi-Latn"];

export function getPack(language: string): DictionaryPack | undefined {
  return packs[language.toLowerCase()];
}
