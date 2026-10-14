import type { DictionaryPack } from "@safetype/shared";
import { en } from "./en/index";

export { en };

/** Built-in packs keyed by language code. Import a single pack (`@safetype/dictionaries/en`) to keep bundles small. */
export const packs: Readonly<Record<string, DictionaryPack>> = { en };

export function getPack(language: string): DictionaryPack | undefined {
  return packs[language.toLowerCase()];
}
