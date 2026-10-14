import { afterEach, describe, expect, it, vi } from "vitest";
import { createSafeTypeEditor, type SafeTypeEditor, type SafeTypeEditorOptions } from "../src";

const editors: SafeTypeEditor[] = [];
function create(options: Partial<SafeTypeEditorOptions> = {}) {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = createSafeTypeEditor({ element, ...options });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
  document.body.innerHTML = "";
});

/** Types like a user: one transaction per character at the cursor. */
function type(st: SafeTypeEditor, text: string) {
  const { editor } = st;
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

describe("moderation while typing", () => {
  it("masks a finished word and leaves the word being typed alone", () => {
    const st = create();
    st.editor.commands.focus("end");
    type(st, "What the fuck");
    expect(st.getText()).toBe("What the fuck");
    type(st, " are you doing?");
    expect(st.getText()).toBe("What the f*ck are you doing?");
    expect(st.getResult().matches).toEqual([]);
  });

  it("does not mask a prefix of a longer word", () => {
    const st = create();
    st.editor.commands.focus("end");
    type(st, "the assassin ");
    expect(st.getText()).toBe("the assassin ");
  });

  it("keeps the cursor where the user is typing", () => {
    const st = create({ content: "<p>hello world</p>" });
    st.editor.commands.setTextSelection(1);
    type(st, "shit ");
    type(st, "X");
    expect(st.getText()).toBe("sh*t Xhello world");
  });

  it("preserves formatting: only changed characters are replaced", () => {
    const st = create({ content: "<p>What the <strong>fuck</strong> is <em><a href=\"https://x.test\">this shit</a></em>?</p>" });
    const before = st.getHTML();
    st.validate();
    // Identical markup; only the masked characters differ.
    expect(st.getHTML()).toBe(before.replace("fuck", "f*ck").replace("shit", "sh*t"));
    expect(st.getHTML()).toContain("<strong>f*ck</strong>");
  });

  it("masks words split across formatting and never joins paragraphs", () => {
    const st = create({ content: "<p>oh <strong>fu</strong>ck</p><p>sh</p><p>it</p>" });
    st.validate();
    expect(st.getHTML()).toBe("<p>oh <strong>f*</strong>ck</p><p>sh</p><p>it</p>");
  });

  it("masks immediately on paste", () => {
    const st = create();
    st.editor.commands.focus("end");
    const tr = st.editor.state.tr.insertText("what the fuck", 1).setMeta("uiEvent", "paste");
    st.editor.view.dispatch(tr);
    expect(st.getText()).toBe("what the f*ck");
  });

  it("undo is not fought: undoing the typing removes it together with its mask", () => {
    const st = create();
    st.editor.commands.focus("end");
    type(st, "fuck ");
    expect(st.getText()).toBe("f*ck ");
    st.editor.commands.undo();
    expect(st.getText()).not.toContain("fuck");
  });

  it("does not rewrite text during IME composition", () => {
    const st = create();
    st.editor.commands.focus("end");
    st.editor.view.dom.dispatchEvent(new CompositionEvent("compositionstart"));
    type(st, "fuck ");
    expect(st.getText()).toBe("fuck ");
  });
});

describe("highlights, messages and suggestions", () => {
  it("highlights harassment with an accessible warning", () => {
    const onWarning = vi.fn();
    const st = create({ content: "<p>you are such an idiot</p>", onWarning });
    const highlight = st.element.querySelector(".safetype-highlight-warn") as HTMLElement;
    expect(highlight.textContent).toBe("you are such an idiot");
    expect(highlight.getAttribute("data-category")).toBe("harassment");
    const status = st.element.querySelector('[role="status"]')!;
    expect(status.textContent).toMatch(/hurtful/);
    expect(st.editor.view.dom.getAttribute("aria-describedby")).toContain(status.id);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it("offers one-click replacement suggestions in suggest mode", () => {
    const st = create({ mode: "suggest", content: "<p>What the <strong>FUCK</strong> is this shit</p>" });
    const buttons = [...st.element.querySelectorAll(".safetype-editor-suggestions button")];
    expect(buttons.map((b) => b.textContent)).toEqual(['Replace "FUCK" with "HECK"', 'Replace "shit" with "shoot"']);
    (buttons[0] as HTMLButtonElement).click();
    expect(st.getHTML()).toBe("<p>What the <strong>HECK</strong> is this shit</p>");
    expect(st.applySuggestions()).toBe(1);
    expect(st.getText()).toBe("What the HECK is this shoot");
    expect(st.element.querySelectorAll(".safetype-editor-suggestions button")).toHaveLength(0);
  });

  it("block mode marks the editor invalid and validate() reports it", () => {
    const st = create({ mode: "block", content: "<p>this is shit</p>" });
    expect(st.editor.view.dom.getAttribute("aria-invalid")).toBe("true");
    expect(st.element.querySelector(".safetype-highlight-block")).not.toBeNull();
    expect(st.validate().valid).toBe(false);
  });

  it("setMode switches behaviour live", () => {
    const st = create({ mode: "warn", content: "<p>shit happens</p>" });
    expect(st.getText()).toBe("shit happens");
    st.setMode("mask");
    st.validate();
    expect(st.getText()).toBe("sh*t happens");
  });

  it("fires onViolation once per change, not per keystroke", () => {
    const onViolation = vi.fn();
    const st = create({ mode: "warn", onViolation });
    st.editor.commands.focus("end");
    type(st, "shit and more words");
    expect(onViolation).toHaveBeenCalledTimes(1);
  });
});

describe("editor features", () => {
  it("renders an accessible toolbar that applies formatting", () => {
    const st = create({ content: "<p>hello</p>" });
    const toolbar = st.element.querySelector('[role="toolbar"]')!;
    const bold = toolbar.querySelector('[aria-label="Bold"]') as HTMLButtonElement;
    expect(bold.tabIndex).toBe(0);
    expect((toolbar.querySelector('[aria-label="Italic"]') as HTMLButtonElement).tabIndex).toBe(-1);
    st.editor.commands.selectAll();
    bold.click();
    expect(st.getHTML()).toBe("<p><strong>hello</strong></p>");
    expect(bold.getAttribute("aria-pressed")).toBe("true");
    (toolbar.querySelector('[aria-label="Heading 1"]') as HTMLButtonElement).click();
    expect(st.getHTML()).toMatch(/^<h1><strong>hello<\/strong><\/h1>/);
    (toolbar.querySelector('[aria-label="Bulleted list"]') as HTMLButtonElement).click();
    expect(st.getHTML()).toContain("<ul>");
  });

  it("moves focus through the toolbar with arrow keys", () => {
    const st = create();
    const buttons = [...st.element.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button')];
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("adds links through requestLink", async () => {
    const st = create({ content: "<p>docs</p>", requestLink: async () => "example.com" });
    st.editor.commands.selectAll();
    (st.element.querySelector('[aria-label="Link"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(st.getHTML()).toContain('href="https://example.com"');
  });

  it("refuses script links and keeps explicit schemes", async () => {
    let next = "javascript:alert(1)";
    const st = create({ content: "<p>docs</p>", requestLink: () => next });
    const link = st.element.querySelector('[aria-label="Link"]') as HTMLButtonElement;
    st.editor.commands.selectAll();
    link.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(st.getHTML()).toBe("<p>docs</p>");
    next = "mailto:team@example.com";
    st.editor.commands.selectAll();
    link.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(st.getHTML()).toContain('href="mailto:team@example.com"');
  });

  it("can hide the toolbar or choose buttons", () => {
    expect(create({ toolbar: false }).element.querySelector('[role="toolbar"]')).toBeNull();
    const custom = create({ toolbar: ["bold", "italic"] });
    expect(custom.element.querySelectorAll('[role="toolbar"] button')).toHaveLength(2);
  });

  it("shows a placeholder, a character count and enforces maxLength", () => {
    const st = create({ placeholder: "Write something...", maxLength: 10 });
    expect(st.element.querySelector("[data-placeholder]")!.getAttribute("data-placeholder")).toBe("Write something...");
    st.editor.commands.focus("end");
    type(st, "hello world and more");
    expect(st.getText().length).toBe(10);
    expect(st.element.querySelector(".safetype-editor-count")!.textContent).toBe("10 / 10");
  });

  it("emits changes and supports setContent", () => {
    const onChange = vi.fn();
    const st = create({ onChange });
    st.editor.commands.focus("end");
    type(st, "hi");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ html: "<p>hi</p>", text: "hi" }));
    st.setContent("<p>replaced</p>");
    expect(st.getHTML()).toBe("<p>replaced</p>");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("supports themes", () => {
    expect(create({ theme: "dark" }).element.dataset.theme).toBe("dark");
    expect(create().element.dataset.theme).toBe("auto");
  });

  it("injects styles once and removes them when the last editor is destroyed", () => {
    const a = create();
    const b = create();
    expect(document.querySelectorAll("style[data-safetype-editor]")).toHaveLength(1);
    a.destroy();
    expect(document.querySelectorAll("style[data-safetype-editor]")).toHaveLength(1);
    b.destroy();
    expect(document.querySelectorAll("style[data-safetype-editor]")).toHaveLength(0);
  });
});

describe("forms", () => {
  it("syncs a hidden input and blocks submission of blocked content", () => {
    const form = document.createElement("form");
    const element = document.createElement("div");
    form.append(element);
    document.body.append(form);
    const onBlocked = vi.fn();
    const appSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", appSubmit);
    const st = createSafeTypeEditor({ element, name: "body", mode: "block", content: "<p>this is shit</p>", onBlocked });
    editors.push(st);
    const hidden = form.querySelector('input[type="hidden"][name="body"]') as HTMLInputElement;
    expect(hidden.value).toBe("<p>this is shit</p>");

    const blocked = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    expect(appSubmit).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);

    st.setContent("<p>this is fine</p>");
    expect(hidden.value).toBe("<p>this is fine</p>");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(appSubmit).toHaveBeenCalledTimes(1);
  });

  it("destroy() removes the editor and its listeners", () => {
    const st = create();
    const root = st.element;
    st.destroy();
    expect(root.isConnected).toBe(false);
    expect(() => st.destroy()).not.toThrow();
  });
});
