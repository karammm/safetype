import type { ModerationMatch } from "@safetype/core";

/** CSS for inline highlights used by the CodeMirror and Monaco adapters. */
export const HIGHLIGHT_STYLES = `
.safetype-highlight-warn{background:rgba(245,176,65,.18);text-decoration:underline wavy #b7791f;text-underline-offset:3px}
.safetype-highlight-block{background:rgba(248,113,113,.16);text-decoration:underline wavy #b42318;text-underline-offset:3px}
.safetype-highlight-suggest{text-decoration:underline dashed #0f7f70;text-underline-offset:3px}
.safetype-highlight-review{text-decoration:underline dotted #6d4bd8;text-underline-offset:3px}
`;

const injected = new WeakSet<Document>();

export function injectHighlightStyles(doc: Document | undefined): void {
  if (!doc || injected.has(doc)) return;
  const style = doc.createElement("style");
  style.setAttribute("data-safetype-highlights", "");
  style.textContent = HIGHLIGHT_STYLES;
  (doc.head ?? doc.documentElement).appendChild(style);
  injected.add(doc);
}

const LABEL: Record<string, string> = {
  warn: "May be hurtful",
  block: "Not allowed",
  suggest: "Suggestion available",
  review: "Needs review",
};

/** Matches worth highlighting (masked matches are about to disappear). */
export function highlightable(matches: readonly ModerationMatch[]): Array<{ match: ModerationMatch; level: string; title: string }> {
  const out: Array<{ match: ModerationMatch; level: string; title: string }> = [];
  for (const match of matches) {
    if (match.action === "mask" || (match.action === "allow" && !match.requiresReview)) continue;
    const level = match.requiresReview ? "review" : match.action;
    const base = `${LABEL[level] ?? level} (${match.category})`;
    out.push({ match, level, title: match.suggestedReplacement ? `${base}: try "${match.suggestedReplacement}"` : base });
  }
  return out;
}
