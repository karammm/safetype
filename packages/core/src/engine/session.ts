import type { AsyncModerationResult, ModerateAsyncOptions, ModerationSession, SessionOptions } from "@safetype/shared";

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError";
}

/**
 * Latest-only async moderation for live typing. Each call supersedes the previous one:
 * the pending debounce is dropped, the in-flight request is aborted, and the stale promise
 * resolves `undefined` so callers never apply an out-of-date result.
 */
export function createSession(
  run: (text: string, options: ModerateAsyncOptions) => Promise<AsyncModerationResult>,
  options: SessionOptions = {},
): ModerationSession {
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolvePending: ((value: undefined) => void) | undefined;

  const supersede = () => {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    resolvePending?.(undefined);
    resolvePending = undefined;
    controller?.abort();
    controller = undefined;
  };

  return {
    moderate(text) {
      supersede();
      const id = generation;
      return new Promise<AsyncModerationResult | undefined>((resolve, reject) => {
        resolvePending = resolve;
        const start = () => {
          timer = undefined;
          const current = new AbortController();
          controller = current;
          run(text, { signal: current.signal }).then(
            (result) => {
              if (id === generation) {
                resolvePending = undefined;
                controller = undefined;
                resolve(result);
              }
            },
            (error: unknown) => {
              if (id !== generation) return;
              resolvePending = undefined;
              controller = undefined;
              if (isAbortError(error)) resolve(undefined);
              else reject(error);
            },
          );
        };
        if (debounceMs > 0) timer = setTimeout(start, debounceMs);
        else start();
      });
    },
    cancel: supersede,
  };
}
