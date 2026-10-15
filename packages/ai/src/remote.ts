import type { ClassifierOutput, ContextualClassifier, ModerationMatch } from "@safetype/core";

export interface RemoteClassifierOptions {
  /** Your server endpoint (e.g. created with `@safetype/ai/server`). */
  endpoint: string;
  name?: string;
  /** Extra headers, e.g. a CSRF token. Never put provider API keys here. */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Send cookies with the request (same-origin auth). Default "same-origin". */
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
}

/** The request body the browser sends to your server. */
export interface RemoteClassifyRequest {
  text: string;
  language: string;
  matches: Array<Pick<ModerationMatch, "ruleId" | "start" | "end" | "category" | "confidence" | "text">>;
}

/**
 * Browser-side classifier that asks *your* server for contextual moderation. The server holds the model
 * credentials; the browser only ever sees SafeType's JSON result. Opt-in: nothing is sent unless you add
 * this to the engine's `classifiers`.
 */
export function remoteClassifier(options: RemoteClassifierOptions): ContextualClassifier {
  const { endpoint, name = "remote", credentials = "same-origin" } = options;
  return {
    name,
    async classify({ text, matches, language, signal }) {
      const doFetch = options.fetch ?? globalThis.fetch;
      const body: RemoteClassifyRequest = {
        text,
        language,
        matches: matches.map(({ ruleId, start, end, category, confidence, text: matched }) => ({ ruleId, start, end, category, confidence, text: matched })),
      };
      const headers = typeof options.headers === "function" ? options.headers() : options.headers;
      const response = await doFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        credentials,
        signal,
      });
      if (!response.ok) throw new Error(`SafeType classifier endpoint responded ${response.status}`);
      const data = (await response.json()) as ClassifierOutput;
      return { matches: Array.isArray(data?.matches) ? data.matches : [], adjustments: Array.isArray(data?.adjustments) ? data.adjustments : [] };
    },
  };
}
