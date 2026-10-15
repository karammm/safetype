import type Anthropic from "@anthropic-ai/sdk";
import type { ContextualClassifier } from "@safetype/core";
import { llmClassifier, type LLMClassifierOptions } from "../llm";

export interface AnthropicClassifierOptions extends Pick<LLMClassifierOptions, "adjust" | "maxTextLength" | "name"> {
  /** Your server-side client: `new Anthropic()` (reads ANTHROPIC_API_KEY). Never construct it in browser code. */
  client: Anthropic;
  /** Default "claude-opus-5-5". */
  model?: string;
  /** Default "low": classification rarely benefits from deeper reasoning. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Default 4096 (thinking shares this budget). */
  maxTokens?: number;
  /**
   * Retry on Anthropic's recommended model if a safety classifier declines the request (server-side
   * fallbacks, Claude API). Default true. Set false on platforms without server-side fallback.
   */
  fallbacks?: boolean;
}

/** Thrown when the model declines; SafeType then keeps the rule-based result for that text. */
export class ClassifierRefusalError extends Error {
  override name = "ClassifierRefusalError";
  constructor(readonly category: string | null) {
    super(`Claude declined to classify this text${category ? ` (${category})` : ""}`);
  }
}

/**
 * Contextual moderation with Claude, for use on your server:
 *
 * ```ts
 * import Anthropic from "@anthropic-ai/sdk";
 * const service = createModerationService({ classifiers: [anthropicClassifier({ client: new Anthropic() })] });
 * ```
 */
export function anthropicClassifier(options: AnthropicClassifierOptions): ContextualClassifier {
  const { client, model = "claude-opus-5-5", effort = "low", maxTokens = 4096, fallbacks = true } = options;
  return llmClassifier({
    name: options.name ?? "claude",
    adjust: options.adjust,
    maxTextLength: options.maxTextLength,
    async complete({ system, user, schema, signal }) {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: maxTokens,
          // The fixed instructions are cached across requests; only the user text varies.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { effort, format: { type: "json_schema", schema: schema as unknown as Record<string, unknown> } },
          ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal },
      );
      if (response.stop_reason === "refusal") throw new ClassifierRefusalError(response.stop_details?.category ?? null);
      if (response.stop_reason === "max_tokens") throw new Error("Claude classifier hit max_tokens; raise maxTokens");
      const block = response.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("Claude classifier returned no text");
      return block.text;
    },
  });
}
