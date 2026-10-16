import type { ModerationAction } from "@safetype/core";
import { onCleanup, onMount, type Accessor } from "solid-js";
import { useEngine } from "./engine";
import { attach, type UseSafeTypeOptions } from "./primitives";

/** `use:safeType` value: options, a mode (`use:safeType="warn"`), or `true`/nothing for defaults. */
export type SafeTypeDirectiveValue = UseSafeTypeOptions | ModerationAction | true | undefined;

function normalize(value: SafeTypeDirectiveValue): UseSafeTypeOptions {
  if (typeof value === "string") return { mode: value };
  return value && value !== true ? value : {};
}

/**
 * Directive for any input, textarea or contenteditable element. Renders messages after the element.
 * `mode` and `policy` update live.
 *
 * ```tsx
 * import { safeType } from "@safetype/solid";
 * safeType; // keep the import: TypeScript can't see directive usage
 * <textarea use:safeType={{ mode: "warn" }} />
 * ```
 */
export function safeType(element: HTMLElement, value: Accessor<SafeTypeDirectiveValue>): void {
  const opts = () => normalize(value());
  const engine = useEngine(opts);
  // Solid runs directives before the element is inserted; messages go next to it, so wait for mount.
  onMount(() => {
    const instance = attach(element, engine, opts, true);
    onCleanup(() => instance.destroy());
  });
}

declare module "solid-js" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface Directives {
      safeType: SafeTypeDirectiveValue;
    }
  }
}
