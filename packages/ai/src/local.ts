import type { ContextualClassifier, ModerationCategory, ProviderMatch, Severity } from "@safetype/core";

export interface LabelScore {
  label: string;
  score: number;
}

export interface LocalModelClassifierOptions {
  /**
   * Your text-classification model, e.g. a Transformers.js pipeline:
   * `const pipe = await pipeline("text-classification", "Xenova/toxic-bert", { top_k: null })`
   * then `classify: (text) => pipe(text)`. Loaded and run by your app (lazily, opt-in); nothing leaves the device.
   */
  classify: (text: string) => Promise<LabelScore[] | LabelScore[][]>;
  name?: string;
  /** Model label -> category (labels not listed are ignored). Defaults suit toxic-bert style models. */
  labels?: Record<string, ModerationCategory>;
  /** Minimum score to report. Default 0.7. */
  threshold?: number;
  severity?: Severity;
}

const DEFAULT_LABELS: Record<string, ModerationCategory> = {
  toxic: "harassment",
  severe_toxic: "harassment",
  insult: "harassment",
  threat: "harassment",
  obscene: "profanity",
  identity_hate: "hate",
};

/**
 * Whole-text classifier for an in-browser (or server) model. Findings cover the whole text, so they warn
 * or block rather than mask (SafeType never masks a multi-word span from a model).
 */
export function localModelClassifier(options: LocalModelClassifierOptions): ContextualClassifier {
  const { classify, name = "local-model", labels = DEFAULT_LABELS, threshold = 0.7, severity = "medium" } = options;
  return {
    name,
    async classify({ text, signal }) {
      if (!text.trim()) return {};
      const raw = await classify(text);
      if (signal.aborted) return {};
      const scores = (Array.isArray(raw[0]) ? (raw as LabelScore[][]).flat() : (raw as LabelScore[])) ?? [];
      const best = new Map<ModerationCategory, LabelScore>();
      for (const s of scores) {
        const category = labels[s.label];
        if (!category || !(s.score >= threshold)) continue;
        if (!best.has(category) || best.get(category)!.score < s.score) best.set(category, s);
      }
      const start = text.length - text.trimStart().length;
      const end = text.trimEnd().length;
      const matches: ProviderMatch[] = [...best].map(([category, s]) => ({
        start,
        end,
        category,
        confidence: Math.min(1, s.score),
        label: s.label,
        severity,
      }));
      return { matches };
    },
  };
}
