import { Editor, type JSONContent } from "@tiptap/core";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";
import {
  createModerationEngine,
  pickEngineConfig,
  type EngineConfig,
  type EngineConfigKey,
  type ModerationAction,
  type ModerationEngine,
  type ModerationMatch,
  type ModerationResult,
  type PolicyMap,
} from "@safetype/core";
import { getMessageLevel, resolveMessage, type MessageLevel, type MessageText } from "@safetype/dom";
import { maskTransaction, moderationKey, SafeTypeModeration } from "./moderation";
import { EDITOR_STYLES } from "./styles";

export type ToolbarItem =
  | "bold" | "italic" | "underline" | "heading1" | "heading2" | "heading3"
  | "bulletList" | "orderedList" | "link" | "undo" | "redo" | "|";

export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  "bold", "italic", "underline", "|", "heading1", "heading2", "|", "bulletList", "orderedList", "|", "link", "|", "undo", "redo",
];

export interface EditorChange {
  html: string;
  text: string;
  json: JSONContent;
}

export interface SafeTypeEditorOptions extends Pick<EngineConfig, EngineConfigKey> {
  /** Element to render into. The editor is appended to it. */
  element: HTMLElement;
  /** Initial content (HTML or Tiptap JSON). */
  content?: string | JSONContent;
  placeholder?: string;
  /** Accessible name for the editing area. Default "Rich text editor". */
  label?: string;
  /** Toolbar buttons, or `false` to hide the toolbar. */
  toolbar?: ToolbarItem[] | false;
  /** Maximum number of characters (shows a counter). `0` shows a counter without a limit. */
  maxLength?: number;
  /** Show the character counter. Default true when `maxLength` is set. */
  showCharacterCount?: boolean;
  theme?: "light" | "dark" | "auto";
  /** Inject the default stylesheet. Default true. */
  injectStyles?: boolean;
  /** Use an existing engine instead of creating one from the engine options. */
  engine?: ModerationEngine;
  messages?: Partial<Record<MessageLevel, MessageText>>;
  /** Name for a hidden input that carries the HTML, so the editor works in plain `<form>` posts. */
  name?: string;
  /** Prevent submission of the surrounding form when content is blocked. Default true. */
  blockSubmit?: boolean;
  editable?: boolean;
  autofocus?: boolean;
  /** Ask the user for a link URL. Default: `window.prompt`. Return null to cancel. */
  requestLink?: (currentHref: string | undefined) => string | null | Promise<string | null>;
  onChange?: (change: EditorChange) => void;
  onModerated?: (result: ModerationResult) => void;
  /** Fires when the set of violations changes (not on every keystroke). */
  onViolation?: (result: ModerationResult) => void;
  onWarning?: (result: ModerationResult) => void;
  /** Fires when a form submission is prevented. */
  onBlocked?: (result: ModerationResult) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SafeTypeEditor {
  /** The underlying Tiptap editor, for advanced use. */
  readonly editor: Editor;
  readonly element: HTMLElement;
  readonly engine: ModerationEngine;
  getHTML(): string;
  getText(): string;
  getJSON(): JSONContent;
  setContent(content: string | JSONContent, options?: { emitChange?: boolean }): void;
  /** Latest moderation result for the editor's text. */
  getResult(): ModerationResult;
  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(): { valid: boolean; result: ModerationResult };
  /** Replaces every match that has a suggested replacement. Returns how many were replaced. */
  applySuggestions(): number;
  setMode(mode: ModerationAction): void;
  setPolicy(policy: PolicyMap): void;
  setEditable(editable: boolean): void;
  focus(): void;
  destroy(): void;
}

const LABELS: Record<Exclude<ToolbarItem, "|">, [label: string, text: string]> = {
  bold: ["Bold", "B"],
  italic: ["Italic", "I"],
  underline: ["Underline", "U"],
  heading1: ["Heading 1", "H1"],
  heading2: ["Heading 2", "H2"],
  heading3: ["Heading 3", "H3"],
  bulletList: ["Bulleted list", "•"],
  orderedList: ["Numbered list", "1."],
  link: ["Link", "\u{1F517}"],
  undo: ["Undo", "↶"],
  redo: ["Redo", "↷"],
};

const styleRefs = new WeakMap<Document, { node: HTMLStyleElement; count: number }>();

function acquireStyles(doc: Document): () => void {
  let ref = styleRefs.get(doc);
  if (ref) ref.count++;
  else {
    const node = doc.createElement("style");
    node.setAttribute("data-safetype-editor", "");
    node.textContent = EDITOR_STYLES;
    (doc.head ?? doc.documentElement).appendChild(node);
    ref = { node, count: 1 };
    styleRefs.set(doc, ref);
  }
  return () => {
    const current = styleRefs.get(doc);
    if (current && --current.count === 0) {
      current.node.remove();
      styleRefs.delete(doc);
    }
  };
}

function violationKey(result: ModerationResult, filter: (m: ModerationMatch) => boolean): string {
  return result.matches.filter(filter).map((m) => `${m.ruleId}:${m.start}:${m.end}:${m.action}`).join("|");
}

let nextId = 0;

/** Creates a rich-text editor with live moderation. */
export function createSafeTypeEditor(options: SafeTypeEditorOptions): SafeTypeEditor {
  const {
    element: host,
    content = "",
    placeholder = "",
    label = "Rich text editor",
    toolbar = DEFAULT_TOOLBAR,
    maxLength = 0,
    showCharacterCount = maxLength > 0,
    theme = "auto",
    injectStyles = true,
    messages,
    name,
    blockSubmit = true,
    editable = true,
    autofocus = false,
  } = options;
  const doc = host.ownerDocument;
  const engine = options.engine ?? createModerationEngine(pickEngineConfig(options));
  const id = `safetype-editor-${++nextId}`;

  // DOM: wrapper > toolbar + content + footer(status, suggestions, count) + hidden input
  const root = doc.createElement("div");
  root.className = "safetype-editor";
  root.dataset.theme = theme;
  const toolbarEl = doc.createElement("div");
  toolbarEl.className = "safetype-editor-toolbar";
  toolbarEl.setAttribute("role", "toolbar");
  toolbarEl.setAttribute("aria-label", "Formatting");
  toolbarEl.setAttribute("aria-controls", `${id}-content`);
  const contentEl = doc.createElement("div");
  contentEl.className = "safetype-editor-content";
  const footer = doc.createElement("div");
  footer.className = "safetype-editor-footer";
  const status = doc.createElement("div");
  status.className = "safetype-editor-status";
  status.id = `${id}-status`;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const suggestions = doc.createElement("ul");
  suggestions.className = "safetype-editor-suggestions";
  suggestions.setAttribute("aria-label", "Suggestions");
  const count = doc.createElement("div");
  count.className = "safetype-editor-count";
  count.id = `${id}-count`;
  footer.append(status, suggestions);
  if (showCharacterCount) footer.append(count);
  if (toolbar) root.append(toolbarEl);
  root.append(contentEl, footer);
  let hidden: HTMLInputElement | null = null;
  if (name) {
    hidden = doc.createElement("input");
    hidden.type = "hidden";
    hidden.name = name;
    root.append(hidden);
  }
  host.append(root);
  const releaseStyles = injectStyles ? acquireStyles(doc) : () => undefined;

  let latest: ModerationResult = engine.moderate("");
  let lastViolations = "";
  let lastWarnings = "";

  const callbacks = () => options;

  const editor = new Editor({
    element: contentEl,
    content,
    editable,
    autofocus,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxLength > 0 ? maxLength : null }),
      SafeTypeModeration.configure({ engine, onResult: (result) => handleResult(result) }),
    ],
    editorProps: {
      attributes: {
        id: `${id}-content`,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        "aria-describedby": [`${id}-status`, showCharacterCount ? `${id}-count` : ""].filter(Boolean).join(" "),
      },
    },
    onUpdate: () => {
      syncHidden();
      updateCount();
      callbacks().onChange?.({ html: editor.getHTML(), text: editor.getText(), json: editor.getJSON() });
    },
    onTransaction: () => updateToolbar(),
    onFocus: () => callbacks().onFocus?.(),
    onBlur: () => callbacks().onBlur?.(),
  });

  // ---- toolbar ----
  const buttons = new Map<ToolbarItem, HTMLButtonElement>();

  /** "example.com" -> "https://example.com"; refuses script-capable schemes. Returns null to refuse. */
  function normalizeHref(raw: string): string | null {
    const href = raw.trim();
    if (/^(javascript|data|vbscript):/i.test(href.replace(/[\s\u0000-\u001f]/g, ""))) return null;
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || /^[/#?]/.test(href)) return href;
    return `https://${href}`;
  }

  async function editLink(): Promise<void> {
    const current = editor.getAttributes("link").href as string | undefined;
    const ask = options.requestLink ?? ((href: string | undefined) => doc.defaultView?.prompt("Link URL", href ?? "https://") ?? null);
    const href = await ask(current);
    if (href === null) return;
    if (href.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const safe = normalizeHref(href);
    if (safe) editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
  }

  const actions: Record<Exclude<ToolbarItem, "|">, () => unknown> = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    underline: () => editor.chain().focus().toggleUnderline().run(),
    heading1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    heading2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    heading3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    bulletList: () => editor.chain().focus().toggleBulletList().run(),
    orderedList: () => editor.chain().focus().toggleOrderedList().run(),
    link: () => editLink(),
    undo: () => editor.chain().focus().undo().run(),
    redo: () => editor.chain().focus().redo().run(),
  };

  const isActive: Partial<Record<ToolbarItem, () => boolean>> = {
    bold: () => editor.isActive("bold"),
    italic: () => editor.isActive("italic"),
    underline: () => editor.isActive("underline"),
    heading1: () => editor.isActive("heading", { level: 1 }),
    heading2: () => editor.isActive("heading", { level: 2 }),
    heading3: () => editor.isActive("heading", { level: 3 }),
    bulletList: () => editor.isActive("bulletList"),
    orderedList: () => editor.isActive("orderedList"),
    link: () => editor.isActive("link"),
  };

  if (toolbar) {
    for (const item of toolbar) {
      if (item === "|") {
        const sep = doc.createElement("span");
        sep.className = "sep";
        sep.setAttribute("role", "separator");
        toolbarEl.append(sep);
        continue;
      }
      const [aria, text] = LABELS[item];
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.setAttribute("aria-label", aria);
      button.title = aria;
      button.dataset.command = item;
      button.tabIndex = buttons.size === 0 ? 0 : -1;
      // Keep the editor's selection when clicking toolbar buttons.
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => void actions[item]());
      buttons.set(item, button);
      toolbarEl.append(button);
    }
    // Roving tabindex: one tab stop, arrow keys move between buttons.
    toolbarEl.addEventListener("keydown", (event) => {
      const list = [...buttons.values()];
      const index = list.indexOf(doc.activeElement as HTMLButtonElement);
      if (index === -1) return;
      const next =
        event.key === "ArrowRight" ? (index + 1) % list.length
        : event.key === "ArrowLeft" ? (index - 1 + list.length) % list.length
        : event.key === "Home" ? 0
        : event.key === "End" ? list.length - 1
        : -1;
      if (next === -1) return;
      event.preventDefault();
      list[index]!.tabIndex = -1;
      list[next]!.tabIndex = 0;
      list[next]!.focus();
    });
  }

  function updateToolbar(): void {
    for (const [item, button] of buttons) {
      const active = isActive[item];
      if (active) button.setAttribute("aria-pressed", String(active()));
      if (item === "undo") button.disabled = !editor.can().undo();
      if (item === "redo") button.disabled = !editor.can().redo();
    }
  }

  // ---- moderation output ----
  function renderSuggestions(result: ModerationResult): void {
    suggestions.replaceChildren();
    for (const match of result.matches) {
      if (match.action !== "suggest" || !match.suggestedReplacement) continue;
      const li = doc.createElement("li");
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = `Replace "${match.text}" with "${match.suggestedReplacement}"`;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => applyMatchSuggestion(match));
      li.append(button);
      suggestions.append(li);
    }
  }

  function handleResult(result: ModerationResult): void {
    latest = result;
    const level = getMessageLevel(result);
    const text = level ? resolveMessage(level, messages, result) : "";
    if (status.textContent !== text) status.textContent = text;
    if (level) status.dataset.level = level;
    else delete status.dataset.level;
    if (level === "block") contentEl.querySelector(".ProseMirror")?.setAttribute("aria-invalid", "true");
    else contentEl.querySelector(".ProseMirror")?.removeAttribute("aria-invalid");
    renderSuggestions(result);
    const cb = callbacks();
    cb.onModerated?.(result);
    const violations = violationKey(result, (m) => m.action !== "allow");
    if (violations !== lastViolations) {
      lastViolations = violations;
      if (violations) cb.onViolation?.(result);
    }
    const warnings = violationKey(result, (m) => m.action === "warn");
    if (warnings !== lastWarnings) {
      lastWarnings = warnings;
      if (warnings) cb.onWarning?.(result);
    }
  }

  function applyMatchSuggestion(match: ModerationMatch): boolean {
    const state = moderationKey.getState(editor.state);
    if (!state || match.suggestedReplacement === undefined) return false;
    const from = state.map.boundaryPos(match.start, "start");
    const to = state.map.boundaryPos(match.end, "end");
    if (from === null || to === null) return false;
    if (editor.state.doc.textBetween(from, to, "\n") !== match.text) return false;
    editor.chain().focus().insertContentAt({ from, to }, match.suggestedReplacement).run();
    return true;
  }

  function syncHidden(): void {
    if (hidden) hidden.value = editor.isEmpty ? "" : editor.getHTML();
  }

  function updateCount(): void {
    if (!showCharacterCount) return;
    const chars = editor.storage.characterCount.characters();
    count.textContent = maxLength > 0 ? `${chars} / ${maxLength}` : `${chars} characters`;
    count.dataset.over = String(maxLength > 0 && chars >= maxLength);
  }

  function refresh(): void {
    editor.view.dispatch(editor.state.tr.setMeta(moderationKey, { refresh: true }));
  }

  function finalPass(): void {
    const tr = maskTransaction(editor.state, "final");
    if (tr) editor.view.dispatch(tr);
  }

  // ---- forms ----
  const form = host.closest("form");
  const onSubmit = (event: Event) => {
    finalPass();
    if (latest.action !== "block") return;
    callbacks().onBlocked?.(latest);
    if (!blockSubmit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editor.commands.focus();
  };
  // Capture on the document so we run before framework submit handlers.
  const submitListener = (event: Event) => {
    if (event.target === form) onSubmit(event);
  };
  if (form) doc.addEventListener("submit", submitListener, true);

  handleResult(moderationKey.getState(editor.state)!.result);
  syncHidden();
  updateCount();
  updateToolbar();

  let destroyed = false;
  return {
    editor,
    element: root,
    engine,
    getHTML: () => editor.getHTML(),
    getText: () => editor.getText(),
    getJSON: () => editor.getJSON(),
    setContent(next, opts = {}) {
      editor.commands.setContent(next, { emitUpdate: opts.emitChange ?? false });
      syncHidden();
      updateCount();
    },
    getResult: () => latest,
    validate() {
      finalPass();
      return { valid: latest.allowed, result: latest };
    },
    applySuggestions() {
      let applied = 0;
      // Apply from the end so earlier offsets stay valid; re-read state after each change.
      for (;;) {
        const candidates = latest.matches.filter((m) => m.action === "suggest" && m.suggestedReplacement !== undefined);
        const match = candidates[candidates.length - 1];
        if (!match || !applyMatchSuggestion(match)) break;
        applied++;
        if (applied > 1000) break;
      }
      return applied;
    },
    setMode(mode) {
      engine.setMode(mode);
      refresh();
    },
    setPolicy(policy) {
      engine.setPolicy(policy);
      refresh();
    },
    setEditable(value) {
      editor.setEditable(value);
    },
    focus: () => editor.commands.focus(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (form) doc.removeEventListener("submit", submitListener, true);
      editor.destroy();
      root.remove();
      releaseStyles();
    },
  };
}
