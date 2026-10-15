/**
 * Tiptap integration lives in `@safetype/editor` (the built-in editor is Tiptap-based). Re-exported here so
 * every editor integration can be found under `@safetype/adapters/*`.
 *
 * ```js
 * import { SafeTypeModeration } from "@safetype/adapters/tiptap";
 * import { createModerationEngine } from "@safetype/core";
 * new Editor({ extensions: [StarterKit, SafeTypeModeration.configure({ engine: createModerationEngine() })] });
 * ```
 */
export { SafeTypeModeration, maskTransaction, moderationKey, type SafeTypeModerationOptions } from "@safetype/editor";
