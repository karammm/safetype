import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSafeType, type SafeTypeInstance } from "../src";

let instance: SafeTypeInstance | undefined;

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  instance?.destroy();
  instance = undefined;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function start(options: Parameters<typeof createSafeType>[0] = {}) {
  instance = createSafeType(options);
  instance.start();
  return instance;
}

/** Simulates the browser after a keystroke: value changed, caret placed, input event fired. */
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string, inputType = "insertText", caret = value.length) {
  el.focus();
  el.value = value;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType }));
}

function field(html: string): HTMLInputElement {
  document.body.innerHTML = html;
  return document.body.querySelector("input, textarea") as HTMLInputElement;
}

describe("eligibility", () => {
  it("attaches to text inputs, textareas and contenteditable hosts", () => {
    document.body.innerHTML = `
      <input id="a"><input id="b" type="search"><textarea id="c"></textarea>
      <div id="d" contenteditable="true"><p id="inner">hi</p></div>`;
    const st = start();
    expect(st.elements.map((e) => e.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it.each([
    `<input type="password">`,
    `<input type="email">`,
    `<input type="number">`,
    `<input type="hidden">`,
    `<input autocomplete="cc-number">`,
    `<input autocomplete="one-time-code">`,
    `<input autocomplete="current-password">`,
    `<input name="user_password">`,
    `<input id="otp-code">`,
    `<input name="card_number">`,
    `<input readonly>`,
    `<input disabled>`,
    `<textarea readonly></textarea>`,
    `<div data-safetype="off"><input></div>`,
    `<input data-safetype="off">`,
    `<div contenteditable="false"></div>`,
    `<div class="ProseMirror" contenteditable="true"></div>`,
    `<div contenteditable="true" data-lexical-editor="true"></div>`,
    `<input class="no-moderation">`,
  ])("never attaches to %s", (html) => {
    document.body.innerHTML = html;
    const st = start({ excludeSelectors: [".no-moderation"] });
    expect(st.elements).toEqual([]);
  });

  it("respects a custom selector", () => {
    document.body.innerHTML = `<input id="a"><textarea id="b" class="chat"></textarea>`;
    expect(start({ selector: ".chat" }).elements.map((e) => e.id)).toEqual(["b"]);
  });
});

describe("live masking in native fields", () => {
  it("masks a finished word and keeps the caret where it was", () => {
    const input = field(`<input>`);
    start();
    type(input, "What the fuck ");
    expect(input.value).toBe("What the f*ck ");
    expect(input.selectionStart).toBe(14);
  });

  it("waits while the word under the caret is still being typed", () => {
    const input = field(`<input>`);
    start();
    type(input, "the ass");
    expect(input.value).toBe("the ass"); // could become "assassin"
    type(input, "the assassin");
    expect(input.value).toBe("the assassin");
    type(input, "the ass ");
    expect(input.value).toBe("the a*s ");
  });

  it("preserves the caret when masking text before it", () => {
    const input = field(`<textarea></textarea>`);
    start();
    type(input, "fuck this and that", "insertText", 10);
    expect(input.value).toBe("f*ck this and that");
    expect(input.selectionStart).toBe(10);
    expect(input.selectionEnd).toBe(10);
  });

  it("masks immediately on paste and drop, even at the caret", () => {
    const input = field(`<input>`);
    start();
    type(input, "what the fuck", "insertFromPaste");
    expect(input.value).toBe("what the f*ck");
    type(input, "oh shit", "insertFromDrop");
    expect(input.value).toBe("oh sh*t");
  });

  it("masks the pending word when the field loses focus", () => {
    const input = field(`<input>`);
    start();
    type(input, "what the fuck");
    expect(input.value).toBe("what the fuck");
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(input.value).toBe("what the f*ck");
  });

  it("does not interfere with IME composition", () => {
    const input = field(`<input>`);
    start();
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "fuck ";
    input.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", isComposing: true }));
    expect(input.value).toBe("fuck ");
    input.dispatchEvent(new CompositionEvent("compositionend"));
    expect(input.value).toBe("f*ck ");
  });

  it("does not undo the user's undo; masking resumes on blur", () => {
    const input = field(`<input>`);
    start();
    type(input, "fuck ", "historyUndo");
    expect(input.value).toBe("fuck ");
    input.dispatchEvent(new FocusEvent("focusout"));
    expect(input.value).toBe("f*ck ");
  });

  it("notifies frameworks through an input event when it rewrites the value", () => {
    const input = field(`<input>`);
    start();
    const seen: string[] = [];
    input.addEventListener("input", () => seen.push(input.value));
    type(input, "fuck ");
    expect(seen).toContain("f*ck ");
  });

  it("uses the prototype value setter so framework value trackers see the change", () => {
    const input = field(`<input>`);
    const tracked: string[] = [];
    // Simulates React's instance-level value tracker.
    const proto = Object.getPrototypeOf(input);
    const native = Object.getOwnPropertyDescriptor(proto, "value")!;
    Object.defineProperty(input, "value", {
      configurable: true,
      get() {
        return native.get!.call(this);
      },
      set(v: string) {
        tracked.push(v);
        native.set!.call(this, v);
      },
    });
    start();
    type(input, "shit ");
    expect(input.value).toBe("sh*t ");
    expect(tracked).toEqual(["shit "]); // only our test's own write went through the instance setter
  });

  it("does not loop on its own input events", () => {
    const input = field(`<input>`);
    const onModerated = vi.fn();
    start({ onModerated });
    type(input, "fuck shit damn ");
    expect(onModerated).toHaveBeenCalledTimes(1);
  });
});

describe("contenteditable", () => {
  it("masks inside formatted text without losing markup", () => {
    document.body.innerHTML = `<div contenteditable="true"><p>What the <b>fuck</b> is <i>this shit</i>?</p></div>`;
    const editor = document.querySelector("div")!;
    start();
    editor.dispatchEvent(new FocusEvent("focusout"));
    expect(editor.innerHTML).toBe(`<p>What the <b>f*ck</b> is <i>this sh*t</i>?</p>`);
  });

  it("masks words split across formatting nodes", () => {
    document.body.innerHTML = `<div contenteditable="true">oh <b>fu</b>ck</div>`;
    const editor = document.querySelector("div")!;
    start();
    editor.dispatchEvent(new FocusEvent("focusout"));
    expect(editor.innerHTML).toBe(`oh <b>f*</b>ck`);
  });

  it("never joins words across paragraphs or line breaks", () => {
    document.body.innerHTML = `<div contenteditable="true"><p>fu</p><p>ck</p>sh<br>it</div>`;
    const editor = document.querySelector("div")!;
    start();
    editor.dispatchEvent(new FocusEvent("focusout"));
    expect(editor.innerHTML).toBe(`<p>fu</p><p>ck</p>sh<br>it`);
    expect(instance!.getResult(editor)!.matches).toEqual([]);
  });

  it("restores the selection after masking", () => {
    document.body.innerHTML = `<div contenteditable="true">fuck this</div>`;
    const editor = document.querySelector("div")!;
    start();
    const text = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 9);
    range.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    editor.dispatchEvent(new InputEvent("input", { inputType: "insertText" }));
    expect(editor.textContent).toBe("f*ck this");
    const sel = getSelection()!.getRangeAt(0);
    expect(sel.startContainer.textContent!.slice(0, sel.startOffset)).toBe("f*ck this");
  });
});

describe("messages and accessibility", () => {
  it("shows a polite, linked warning for harassment and clears it when fixed", () => {
    const input = field(`<input aria-describedby="hint">`);
    start();
    type(input, "you are an idiot ");
    const message = document.querySelector(".safetype-message") as HTMLElement;
    expect(message).not.toBeNull();
    expect(message.getAttribute("role")).toBe("status");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(message.dataset.level).toBe("warn");
    expect(input.getAttribute("aria-describedby")).toBe(`hint ${message.id}`);
    expect(input.nextElementSibling).toBe(message);

    type(input, "you are great ");
    expect(document.querySelector(".safetype-message")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBe("hint");
  });

  it("supports custom message text", () => {
    const input = field(`<input>`);
    start({ mode: "block", messages: { block: (r) => `Blocked ${r.matches.length} issue(s)` } });
    type(input, "shit ");
    expect(document.querySelector(".safetype-message")!.textContent).toBe("Blocked 1 issue(s)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("can disable messages and style injection", () => {
    const input = field(`<input>`);
    start({ showMessages: false });
    type(input, "you are an idiot ");
    expect(document.querySelector(".safetype-message")).toBeNull();
    expect(document.querySelector("style[data-safetype]")).toBeNull();
  });

  it("injects styles once and removes them on stop", () => {
    document.body.innerHTML = `<input>`;
    const a = createSafeType();
    const b = createSafeType();
    a.start();
    b.start();
    expect(document.querySelectorAll("style[data-safetype]")).toHaveLength(1);
    a.stop();
    expect(document.querySelectorAll("style[data-safetype]")).toHaveLength(1);
    b.stop();
    expect(document.querySelectorAll("style[data-safetype]")).toHaveLength(0);
  });
});

describe("form submission", () => {
  function submit(form: HTMLFormElement) {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event;
  }

  it("blocks submission when a field is blocked and focuses it", () => {
    document.body.innerHTML = `<form><input name="title"><textarea name="body"></textarea></form>`;
    const form = document.querySelector("form")!;
    const textarea = document.querySelector("textarea")!;
    const onBlocked = vi.fn();
    const appHandler = vi.fn();
    form.addEventListener("submit", appHandler);
    start({ mode: "block", onBlocked });
    textarea.value = "this is shit"; // set programmatically, no input event
    const event = submit(form);
    expect(event.defaultPrevented).toBe(true);
    expect(appHandler).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith(expect.objectContaining({ action: "block" }), textarea);
    expect(document.activeElement).toBe(textarea);
  });

  it("lets clean content through and masks pending words before submit", () => {
    document.body.innerHTML = `<form><input></form>`;
    const input = document.querySelector("input")!;
    start({ mode: "mask" });
    type(input, "what the fuck");
    const event = submit(document.querySelector("form")!);
    expect(event.defaultPrevented).toBe(false);
    expect(input.value).toBe("what the f*ck");
  });

  it("can report without blocking", () => {
    document.body.innerHTML = `<form><input value="shit"></form>`;
    const onBlocked = vi.fn();
    start({ mode: "block", blockSubmit: false, onBlocked });
    expect(submit(document.querySelector("form")!).defaultPrevented).toBe(false);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("validate() checks every field", () => {
    document.body.innerHTML = `<input id="a" value="hello"><input id="b" value="shit">`;
    const st = start({ mode: "block" });
    const { valid, results } = st.validate();
    expect(valid).toBe(false);
    expect(results.map((r) => [r.element.id, r.result.allowed])).toEqual([["a", true], ["b", false]]);
  });
});

describe("dynamic elements and lifecycle", () => {
  it("attaches to fields added later and detaches removed ones", async () => {
    const st = start();
    const input = document.createElement("input");
    const wrapper = document.createElement("div");
    wrapper.append(input);
    document.body.append(wrapper);
    await flush();
    expect(st.elements).toEqual([input]);
    type(input, "shit ");
    expect(input.value).toBe("sh*t ");

    wrapper.remove();
    await flush();
    expect(st.elements).toEqual([]);
  });

  it("re-evaluates when attributes change", async () => {
    document.body.innerHTML = `<div id="w"><input id="x"></div>`;
    const st = start();
    const input = document.getElementById("x") as HTMLInputElement;
    input.setAttribute("type", "password");
    await flush();
    expect(st.elements).toEqual([]);
    input.setAttribute("type", "text");
    await flush();
    expect(st.elements).toEqual([input]);
    document.getElementById("w")!.setAttribute("data-safetype", "off");
    await flush();
    expect(st.elements).toEqual([]);
  });

  it("can skip observing dynamic elements", async () => {
    const st = start({ observeDynamicElements: false });
    document.body.append(document.createElement("input"));
    await flush();
    expect(st.elements).toEqual([]);
  });

  it("is idempotent: no duplicate listeners from repeated start/attach", () => {
    const input = field(`<input>`);
    const onModerated = vi.fn();
    const st = start({ onModerated });
    st.start();
    st.attach(input);
    st.attach(input);
    type(input, "hello");
    expect(onModerated).toHaveBeenCalledTimes(1);
  });

  it("stop() removes listeners and messages; start() resumes", () => {
    const input = field(`<input>`);
    const st = start();
    type(input, "you are an idiot ");
    expect(document.querySelector(".safetype-message")).not.toBeNull();
    st.stop();
    expect(st.running).toBe(false);
    expect(document.querySelector(".safetype-message")).toBeNull();
    type(input, "shit ");
    expect(input.value).toBe("shit ");
    st.start();
    type(input, "shit ");
    expect(input.value).toBe("sh*t ");
  });

  it("destroy() is final", () => {
    const st = start();
    st.destroy();
    expect(() => st.start()).toThrow(/destroyed/);
  });

  it("supports a scoped root", () => {
    document.body.innerHTML = `<section id="chat"><input id="in"></section><input id="out">`;
    const st = start({ root: document.getElementById("chat")! });
    expect(st.elements.map((e) => e.id)).toEqual(["in"]);
  });

  it("blocks the surrounding form when scoped to a single field", () => {
    document.body.innerHTML = `<form><input id="only"></form>`;
    const input = document.getElementById("only") as HTMLInputElement;
    const st = start({ root: input, mode: "block" });
    expect(st.elements).toEqual([input]);
    input.value = "shit";
    const event = new Event("submit", { bubbles: true, cancelable: true });
    document.querySelector("form")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("works inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<input>`;
    const input = shadow.querySelector("input")!;
    const st = start({ root: shadow });
    expect(st.elements).toEqual([input]);
    expect(shadow.querySelector("style[data-safetype]")).not.toBeNull();
  });
});

describe("events", () => {
  it("dispatches DOM events and calls callbacks once per change, not per keystroke", () => {
    const input = field(`<input>`);
    const onViolation = vi.fn();
    const domViolation = vi.fn();
    document.addEventListener("safetype:violation", domViolation);
    start({ mode: "warn", onViolation });
    type(input, "shit ");
    type(input, "shit a");
    type(input, "shit ab");
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(domViolation).toHaveBeenCalledTimes(1);
    expect(domViolation.mock.calls[0]![0].detail.element).toBe(input);
    type(input, "shit ab shit ");
    expect(onViolation).toHaveBeenCalledTimes(2);
    document.removeEventListener("safetype:violation", domViolation);
  });

  it("reports callback errors through onError without breaking moderation", () => {
    const input = field(`<input>`);
    const onError = vi.fn();
    start({
      onError,
      onModerated: () => {
        throw new Error("app bug");
      },
    });
    type(input, "fuck ");
    expect(input.value).toBe("f*ck ");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "app bug" }), input);
  });

  it("runs contextual classifiers after typing pauses and ignores stale results", async () => {
    const input = field(`<input>`);
    const classify = vi.fn(async ({ text }: { text: string }) =>
      text.includes("vermin") ? { matches: [{ start: 0, end: text.length, category: "hate" as const, confidence: 0.95 }] } : {},
    );
    start({ mode: "warn", classifiers: [{ name: "ctx", classify }], asyncDebounceMs: 10 });
    type(input, "they are");
    type(input, "they are vermin");
    await new Promise((r) => setTimeout(r, 40));
    expect(classify).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".safetype-message")!.getAttribute("data-level")).toBe("warn");
  });
});
