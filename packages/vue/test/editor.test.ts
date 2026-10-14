import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick, ref, shallowRef } from "vue";
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

describe("<SafeTypeEditor> (Vue)", () => {
  it("supports v-model with masked HTML", async () => {
    const html = ref("<p></p>");
    const comp = shallowRef<{ editor: SafeTypeEditorHandle } | null>(null);
    const wrapper = mount(
      {
        components: { SafeTypeEditor },
        setup: () => ({ html, comp }),
        template: `<SafeTypeEditor ref="comp" v-model="html" placeholder="Write..." />`,
      },
      { attachTo: document.body },
    );
    typeInto(comp.value!.editor, "What the fuck is this");
    expect(html.value).toBe("<p>What the f*ck is this</p>");
    html.value = "<p>external</p>";
    await nextTick();
    expect(comp.value!.editor.getHTML()).toBe("<p>external</p>");
    wrapper.unmount();
    expect(document.querySelector(".safetype-editor")).toBeNull();
  });

  it("updates mode live and emits moderation events", async () => {
    const mode = ref<"warn" | "mask">("warn");
    const warnings: unknown[] = [];
    const comp = shallowRef<{ editor: SafeTypeEditorHandle; validate: () => unknown } | null>(null);
    mount(
      {
        components: { SafeTypeEditor },
        setup: () => ({ mode, comp, onWarning: (r: unknown) => warnings.push(r) }),
        template: `<SafeTypeEditor ref="comp" :mode="mode" model-value="<p>shit happens</p>" @warning="onWarning" />`,
      },
      { attachTo: document.body },
    );
    expect(warnings).toHaveLength(1);
    mode.value = "mask";
    await nextTick();
    comp.value!.validate();
    expect(comp.value!.editor.getText()).toBe("sh*t happens");
  });
});
