import { createComponent, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { SafeTypeEditor, type SafeTypeEditorHandle } from "../src/editor";

afterEach(() => {
  document.body.innerHTML = "";
});

function typeInto(handle: SafeTypeEditorHandle, text: string) {
  const { editor } = handle;
  editor.commands.focus("end");
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

describe("<SafeTypeEditor> (Solid)", () => {
  it("is controlled: masked HTML flows out, outside changes flow in", () => {
    const [html, setHtml] = createSignal("<p></p>");
    let api!: SafeTypeEditorHandle;
    const container = document.body.appendChild(document.createElement("div"));
    const dispose = render(
      () =>
        createComponent(SafeTypeEditor, {
          get value() {
            return html();
          },
          onValueChange: setHtml,
          placeholder: "Write...",
          apiRef: (a) => (api = a),
        }),
      container,
    );
    typeInto(api, "What the fuck is this");
    expect(html()).toBe("<p>What the f*ck is this</p>");
    setHtml("<p>external</p>");
    expect(api.getHTML()).toBe("<p>external</p>");
    dispose();
    expect(document.querySelector(".safetype-editor")).toBeNull();
  });

  it("updates mode live and reports warnings", () => {
    const [mode, setMode] = createSignal<"warn" | "mask">("warn");
    const warnings: unknown[] = [];
    let api!: SafeTypeEditorHandle;
    render(
      () =>
        createComponent(SafeTypeEditor, {
          get mode() {
            return mode();
          },
          value: "<p>shit happens</p>",
          onWarning: (r) => warnings.push(r),
          apiRef: (a) => (api = a),
        }),
      document.body.appendChild(document.createElement("div")),
    );
    expect(warnings).toHaveLength(1);
    setMode("mask");
    api.validate();
    expect(api.getText()).toBe("sh*t happens");
  });
});
