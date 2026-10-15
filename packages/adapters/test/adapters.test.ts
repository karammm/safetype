import type { TextFormatType } from "lexical";
import { describe, expect, it, vi, afterEach } from "vitest";
import { Moderator, type EditorBinding } from "../src";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  document.body.innerHTML = "";
});

describe("adapter contract (Moderator)", () => {
  function fakeEditor(initial = "") {
    let text = initial;
    let caret: number | null = null;
    const binding: EditorBinding = {
      getText: () => text,
      getCaret: () => caret,
      applyEdits: (edits) => {
        for (const e of [...edits].sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
      },
    };
    return {
      binding,
      type(value: string) {
        text = value;
        caret = value.length;
      },
      get text() {
        return text;
      },
    };
  }

  it("masks finished words, defers the word being typed, and reports violations once", () => {
    const editor = fakeEditor();
    const onViolation = vi.fn();
    const moderator = new Moderator(editor.binding, { onViolation }, null, null);
    editor.type("what the fuck");
    moderator.run("typing");
    expect(editor.text).toBe("what the fuck");
    editor.type("what the fuck ");
    moderator.run("typing");
    expect(editor.text).toBe("what the f*ck ");
    editor.type("what the fuck is this");
    moderator.run("final");
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it("observe passes (undo/redo) never rewrite text", () => {
    const editor = fakeEditor("oh shit ");
    new Moderator(editor.binding, {}, null, null).run("observe");
    expect(editor.text).toBe("oh shit ");
  });

  it("does nothing while an IME is composing", () => {
    const editor = fakeEditor("fuck ");
    const moderator = new Moderator({ ...editor.binding, isComposing: () => true }, {}, null, null);
    moderator.run("typing");
    expect(editor.text).toBe("fuck ");
  });

  it("renders an accessible message after the anchor", () => {
    const anchor = document.createElement("div");
    const field = document.createElement("div");
    document.body.append(anchor);
    const editor = fakeEditor("you are an idiot");
    new Moderator(editor.binding, {}, anchor, field).run("final");
    const message = anchor.nextElementSibling as HTMLElement;
    expect(message.getAttribute("role")).toBe("status");
    expect(message.textContent).toMatch(/hurtful/);
    expect(field.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("validate() reports blocked content", () => {
    const editor = fakeEditor("this is shit");
    const moderator = new Moderator(editor.binding, { mode: "block" }, null, null);
    expect(moderator.validate().valid).toBe(false);
  });
});

describe("ProseMirror", async () => {
  const { EditorState } = await import("prosemirror-state");
  const { EditorView } = await import("prosemirror-view");
  const { schema } = await import("prosemirror-schema-basic");
  const { history, undo } = await import("prosemirror-history");
  const { DOMParser } = await import("prosemirror-model");
  const { TextSelection } = await import("prosemirror-state");
  const { safeTypeProseMirror } = await import("../src/prosemirror");

  function setup(html: string, options = {}) {
    const st = safeTypeProseMirror(options);
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = html;
    const doc = DOMParser.fromSchema(schema).parse(host);
    host.innerHTML = "";
    const view = new EditorView(host, { state: EditorState.create({ doc, plugins: [history(), st.plugin] }) });
    const type = (text: string) => {
      for (const ch of text) {
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(ch, from, to));
      }
    };
    return { st, view, type, host };
  }

  it("masks while typing, keeps marks, and highlights warnings", () => {
    const { view, type, st } = setup("<p>hi <strong>there</strong></p>");
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    type(" fuck you are an idiot");
    expect(view.state.doc.textContent).toBe("hi there f*ck you are an idiot");
    expect(view.dom.querySelector(".safetype-highlight-warn")?.textContent).toBe("you are an idiot");
    expect(st.getResult(view.state)?.action).toBe("warn");
    st.validate(view);
    const fresh = setup("<p>oh <em>shit</em> ok</p>");
    fresh.st.validate(fresh.view);
    expect(fresh.view.dom.innerHTML).toContain("<em>sh*t</em>");
  });

  it("undo removes the typing together with its mask", () => {
    const { view, type } = setup("<p></p>");
    type("fuck ");
    expect(view.state.doc.textContent).toBe("f*ck ");
    undo(view.state, view.dispatch);
    expect(view.state.doc.textContent).not.toContain("fuck");
  });
});

describe("CodeMirror 6", async () => {
  const { EditorState } = await import("@codemirror/state");
  const { EditorView } = await import("@codemirror/view");
  const { history, undo } = await import("@codemirror/commands");
  const { safeTypeCodeMirror } = await import("../src/codemirror");

  function setup(doc = "", options = {}) {
    const st = safeTypeCodeMirror(options);
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state: EditorState.create({ doc, extensions: [history(), st.extension] }), parent });
    view.focus(); // the word under the cursor is only deferred while the user is typing in the editor
    const type = (text: string) => {
      for (const ch of text) {
        const head = view.state.selection.main.head;
        view.dispatch({ changes: { from: head, insert: ch }, selection: { anchor: head + 1 }, userEvent: "input.type" });
      }
    };
    return { st, view, type, parent };
  }

  it("masks finished words through transactions and keeps the cursor", async () => {
    const { view, type } = setup();
    type("what the fuck");
    await flush();
    expect(view.state.doc.toString()).toBe("what the fuck");
    type(" now");
    await flush();
    expect(view.state.doc.toString()).toBe("what the f*ck now");
    expect(view.state.selection.main.head).toBe(17);
  });

  it("highlights harassment and renders a message", async () => {
    const { view, type, parent } = setup();
    type("you are an idiot");
    await flush();
    expect(view.contentDOM.querySelector(".safetype-highlight-warn")?.textContent).toBe("you are an idiot");
    expect(parent.querySelector(".safetype-message")?.textContent).toMatch(/hurtful/);
  });

  it("undo is not re-masked; paste is masked immediately", async () => {
    const { view, type } = setup();
    type("shit ");
    await flush();
    expect(view.state.doc.toString()).toBe("sh*t ");
    undo(view);
    await flush();
    expect(view.state.doc.toString()).not.toBe("sh*t ");
    view.dispatch({ changes: { from: view.state.doc.length, insert: "oh fuck" }, userEvent: "input.paste" });
    await flush();
    expect(view.state.doc.toString()).toContain("oh f*ck");
  });
});

describe("Lexical", async () => {
  const lexical = await import("lexical");
  const { registerRichText } = await import("@lexical/rich-text");
  const { createEmptyHistoryState, registerHistory } = await import("@lexical/history");
  const { safeTypeLexical } = await import("../src/lexical");

  function setup(options = {}) {
    const editor = lexical.createEditor({ namespace: "test", onError: (e) => { throw e; } });
    const root = document.createElement("div");
    root.contentEditable = "true";
    document.body.append(root);
    editor.setRootElement(root);
    registerRichText(editor);
    registerHistory(editor, createEmptyHistoryState(), 300);
    const st = safeTypeLexical(editor, options);
    const insert = (text: string, format?: TextFormatType) =>
      editor.update(
        () => {
          const selection = lexical.$getSelection() ?? lexical.$getRoot().selectEnd();
          if (lexical.$isRangeSelection(selection)) {
            if (format && !selection.hasFormat(format)) selection.formatText(format);
            selection.insertText(text);
          }
        },
        { discrete: true },
      );
    const text = () => editor.getEditorState().read(() => lexical.$getRoot().getTextContent());
    return { editor, st, insert, text, root };
  }

  it("masks finished words and keeps formatting", async () => {
    const { st, insert, text, editor } = setup();
    insert("hello ");
    insert("shit", "bold");
    await flush();
    expect(text()).toBe("hello shit");
    insert(" there");
    await flush();
    expect(text()).toBe("hello sh*t there");
    const bold = editor.getEditorState().read(() =>
      lexical.$getRoot().getAllTextNodes().filter((n) => n.hasFormat("bold")).map((n) => n.getTextContent()),
    );
    expect(bold.join("")).toContain("sh*t");
    // getResult() describes what the last pass found (before it masked), like every adapter.
    expect(st.getResult()?.text).toBe("hello sh*t there");
  });

  it("warns about harassment with an accessible message and validates", async () => {
    const { st, insert, root } = setup({ policy: { harassment: { action: "block" } } });
    insert("you are such an idiot");
    await flush();
    expect(root.nextElementSibling?.getAttribute("data-level")).toBe("block");
    expect(st.validate().valid).toBe(false);
  });
});

describe("Quill 2", async () => {
  const Quill = (await import("quill")).default;
  const { safeTypeQuill } = await import("../src/quill");

  function setup(options = {}) {
    const host = document.createElement("div");
    document.body.append(host);
    const quill = new Quill(host);
    const st = safeTypeQuill(quill as never, options);
    const type = (text: string) => {
      for (const ch of text) {
        const at = quill.getLength() - 1;
        quill.insertText(at, ch, "user");
      }
    };
    return { quill, st, type, host };
  }

  it("masks through updateContents and keeps formatting", async () => {
    const { quill, type } = setup();
    quill.insertText(0, "fuck", { bold: true }, "user");
    type(" ");
    await flush();
    expect(quill.getText()).toBe("f*ck \n");
    // Bold is kept on the masked word (the typed space inherits it, as Quill does for any typing).
    expect(quill.getContents().ops[0]).toEqual({ insert: "f*ck ", attributes: { bold: true } });
  });

  it("masks pasted text and reports harassment", async () => {
    const onWarning = vi.fn();
    const { quill } = setup({ onWarning });
    quill.insertText(0, "oh shit, you are an idiot", "user");
    await flush();
    expect(quill.getText()).toBe("oh sh*t, you are an idiot\n");
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(quill.container.nextElementSibling?.textContent).toMatch(/hurtful/);
  });

  it("does not undo the user's undo", async () => {
    const { quill, type } = setup();
    type("fuck ");
    await flush();
    expect(quill.getText()).toBe("f*ck \n");
    quill.root.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }));
    (quill as unknown as { history: { undo(): void } }).history.undo();
    await flush();
    expect(quill.getText()).not.toBe("f*ck \n");
  });

  it("destroy() stops moderating", async () => {
    const { quill, st } = setup();
    st.destroy();
    quill.insertText(0, "fuck ", "user");
    await flush();
    expect(quill.getText()).toBe("fuck \n");
  });
});
