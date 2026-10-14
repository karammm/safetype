import type { App } from "vue";
import { SafeTypeInput, SafeTypeTextarea } from "./components";
import { createSafeTypeDirective } from "./directive";
import { createShared, SAFE_TYPE_KEY, type EngineOptions } from "./engine";

/**
 * `app.use(SafeTypePlugin, { mode: "mask", customWords: [...] })`
 * Shares one engine with the whole app and registers `v-safe-type`, `<SafeTypeInput>` and `<SafeTypeTextarea>`.
 */
export const SafeTypePlugin = {
  install(app: App, options: EngineOptions = {}) {
    const shared = createShared(options);
    app.provide(SAFE_TYPE_KEY, shared);
    app.directive("safe-type", createSafeTypeDirective(shared));
    app.component("SafeTypeInput", SafeTypeInput);
    app.component("SafeTypeTextarea", SafeTypeTextarea);
  },
};
