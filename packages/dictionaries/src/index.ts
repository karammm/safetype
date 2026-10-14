import type { DictionaryPack } from "@safetype/shared";
import { en } from "./en/index";
import { hiLatn } from "./hi-latn/index";

export { en, hiLatn };

/** Built-in packs keyed by lowercase language tag. Import a single pack (`@safetype/dictionaries/en`) to keep bundles small. */
export const packs: Readonly<Record<string, DictionaryPack>> = { en, "hi-latn": hiLatn };

/** Languages enabled when an engine is created without `languages` or `packs`. */
export const DEFAULT_LANGUAGES: readonly string[] = ["en", "hi-Latn"];

export function getPack(language: string): DictionaryPack | undefined {
  return packs[language.toLowerCase()];
}
