import userEvent from "@testing-library/user-event";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import {
  provideSafeType,
  SafeTypeInput,
  SafeTypePlugin,
  SafeTypeTextarea,
  useModeration,
  useSafeType,
  useSafeTypeEngine,
  vSafeType,
} from "../src";

const wrappers: VueWrapper[] = [];
function mountApp(component: object, options: Parameters<typeof mount>[1] = {}) {
  const wrapper = mount(component, { attachTo: document.body, ...options });
  wrappers.push(wrapper);
  return wrapper;
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  document.body.innerHTML = "";
});

const field = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("v-safe-type directive", () => {
  it("masks while typing and v-model receives the masked text", async () => {
    const text = ref("");
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ text }),
      template: `<input aria-label="d" v-safe-type v-model="text">`,
    });
    await userEvent.type(field("d"), "What the fuck are you doing?");
    expect(field("d").value).toBe("What the f*ck are you doing?");
    expect(text.value).toBe("What the f*ck are you doing?");
  });

  it("keeps the caret and does not mask an unfinished word", async () => {
    const text = ref("");
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ text }),
      template: `<textarea aria-label="t" v-safe-type v-model="text"></textarea>`,
    });
    await userEvent.type(field("t"), "the assassin hello");
    expect(text.value).toBe("the assassin hello");
    field("t").setSelectionRange(0, 0);
    await userEvent.type(field("t"), "fuck ", { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(text.value).toBe("f*ck the assassin hello");
    expect(field("t").selectionStart).toBe(5);
  });

  it("accepts a mode as argument, string value, or options object", async () => {
    mountApp({
      directives: { safeType: vSafeType },
      template: `
        <input aria-label="arg" v-safe-type:warn>
        <input aria-label="str" v-safe-type="'block'">
        <input aria-label="obj" v-safe-type="{ mode: 'mask', customWords: ['frak'] }">`,
    });
    await userEvent.type(field("arg"), "shit ");
    await userEvent.type(field("str"), "shit ");
    await userEvent.type(field("obj"), "frak ");
    expect(field("arg").value).toBe("shit ");
    expect(field("arg").nextElementSibling?.getAttribute("data-level")).toBe("warn");
    expect(field("str").getAttribute("aria-invalid")).toBe("true");
    expect(field("obj").value).toBe("fr*k ");
  });

  it("updates the mode live from the binding", async () => {
    const mode = ref("warn");
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ mode }),
      template: `<input aria-label="live" v-safe-type="{ mode }">`,
    });
    await userEvent.type(field("live"), "shit ");
    expect(field("live").value).toBe("shit ");
    mode.value = "mask";
    await nextTick();
    await userEvent.type(field("live"), "shit ");
    expect(field("live").value).toBe("sh*t sh*t ");
  });

  it("calls callbacks from the binding and cleans up on unmount", async () => {
    const onViolation = vi.fn();
    const show = ref(true);
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ show, onViolation }),
      template: `<div><input v-if="show" aria-label="cb" v-safe-type="{ mode: 'warn', onViolation }"></div>`,
    });
    const input = field("cb");
    await userEvent.type(input, "you are an idiot ");
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".safetype-message")).not.toBeNull();
    show.value = false;
    await nextTick();
    await tick();
    expect(document.querySelector(".safetype-message")).toBeNull();
  });

  it("survives v-if / v-else swapping a field that shows a message", async () => {
    const show = ref(true);
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ show }),
      template: `<div id="box"><input v-if="show" aria-label="swap" v-safe-type:warn><p v-else>gone</p><span>after</span></div>`,
    });
    await userEvent.type(field("swap"), "shit ");
    expect(document.querySelector(".safetype-message")).not.toBeNull();
    show.value = false;
    await nextTick();
    await tick();
    expect(document.getElementById("box")!.innerHTML.replace(/<!--.*?-->/g, "")).toBe("<p>gone</p><span>after</span>");
    show.value = true;
    await nextTick();
    expect(field("swap")).not.toBeNull();
  });

  it("blocks @submit in block mode", async () => {
    const onSubmit = vi.fn();
    mountApp({
      directives: { safeType: vSafeType },
      setup: () => ({ onSubmit }),
      template: `<form @submit.prevent="onSubmit"><input aria-label="f" v-safe-type:block><button>Send</button></form>`,
    });
    await userEvent.type(field("f"), "this is shit");
    await userEvent.click(document.querySelector("button")!);
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.clear(field("f"));
    await userEvent.type(field("f"), "this is fine");
    await userEvent.click(document.querySelector("button")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("works on contenteditable and preserves formatting", async () => {
    mountApp({
      directives: { safeType: vSafeType },
      template: `<div aria-label="ce" contenteditable="true" v-safe-type><b>fuck</b> this</div>`,
    });
    field("ce").dispatchEvent(new FocusEvent("focusout"));
    expect(field("ce").innerHTML).toBe("<b>f*ck</b> this");
  });
});

describe("SafeTypePlugin", () => {
  it("shares configuration with the global directive and components", async () => {
    const a = ref("");
    mountApp(
      {
        setup: () => ({ a }),
        template: `<input aria-label="g" v-safe-type v-model="a"><SafeTypeTextarea aria-label="gt" />`,
      },
      { global: { plugins: [[SafeTypePlugin, { customWords: ["frak"] }]] } },
    );
    await userEvent.type(field("g"), "frak ");
    await userEvent.type(field("gt"), "frak ");
    expect(a.value).toBe("fr*k ");
    expect(field("gt").value).toBe("fr*k ");
  });

  it("lets a field override the mode while inheriting the plugin config", async () => {
    mountApp(
      { template: `<input aria-label="o" v-safe-type:warn>` },
      { global: { plugins: [[SafeTypePlugin, { customWords: ["frak"] }]] } },
    );
    await userEvent.type(field("o"), "frak ");
    expect(field("o").value).toBe("frak ");
    expect(field("o").nextElementSibling?.getAttribute("data-level")).toBe("warn");
  });

  it("provideSafeType() scopes an engine to a subtree", () => {
    let fromChild: unknown;
    let provided: unknown;
    const Child = defineComponent({
      setup() {
        fromChild = useSafeTypeEngine();
        return () => null;
      },
    });
    mountApp({
      components: { Child },
      setup() {
        provided = provideSafeType({ mode: "warn" });
        return {};
      },
      template: `<Child />`,
    });
    expect(fromChild).toBe(provided);
  });
});

describe("<SafeTypeInput> / <SafeTypeTextarea>", () => {
  it("supports v-model and emits moderation results", async () => {
    const text = ref("");
    const onModeration = vi.fn();
    mountApp({
      components: { SafeTypeInput },
      setup: () => ({ text, onModeration }),
      template: `<SafeTypeInput aria-label="c" v-model="text" @moderation="onModeration" />`,
    });
    await userEvent.type(field("c"), "oh shit ok");
    expect(text.value).toBe("oh sh*t ok");
    expect(onModeration).toHaveBeenCalled();
  });

  it("renders an accessible message and links it", async () => {
    mountApp({
      components: { SafeTypeTextarea },
      template: `<SafeTypeTextarea aria-label="m" aria-describedby="hint" />`,
    });
    const status = document.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("");
    await userEvent.type(field("m"), "you are an idiot ");
    await nextTick();
    expect(status.textContent).toMatch(/hurtful/);
    expect(field("m").getAttribute("aria-describedby")).toBe(`hint ${status.id}`);
  });

  it("supports custom messages, block mode and hiding the message", async () => {
    mountApp({
      components: { SafeTypeInput },
      template: `
        <SafeTypeInput aria-label="b" mode="block" :messages="{ block: 'Nope' }" />
        <SafeTypeInput aria-label="h" mode="block" :show-message="false" />`,
    });
    await userEvent.type(field("b"), "shit ");
    await userEvent.type(field("h"), "shit ");
    await nextTick();
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(document.querySelector('[role="status"]')!.textContent).toBe("Nope");
    expect(field("b").getAttribute("aria-invalid")).toBe("true");
  });

  it("passes through attributes and listeners, and exposes validate()", async () => {
    const onInput = vi.fn();
    const comp = ref<{ validate: () => { valid: boolean } } | null>(null);
    mountApp({
      components: { SafeTypeInput },
      setup: () => ({ onInput, comp }),
      template: `<SafeTypeInput ref="comp" aria-label="p" placeholder="Say hi" class="x" mode="block" @input="onInput" />`,
    });
    expect(field("p").getAttribute("placeholder")).toBe("Say hi");
    expect(field("p").classList.contains("x")).toBe(true);
    await userEvent.type(field("p"), "shit");
    expect(onInput).toHaveBeenCalled();
    expect(comp.value!.validate().valid).toBe(false);
  });

  it("works uncontrolled", async () => {
    mountApp({ components: { SafeTypeInput }, template: `<SafeTypeInput aria-label="u" />` });
    await userEvent.type(field("u"), "shit ");
    expect(field("u").value).toBe("sh*t ");
  });
});

describe("composables", () => {
  it("useSafeType moderates a template ref and exposes result and message", async () => {
    let api: ReturnType<typeof useSafeType> | undefined;
    mountApp({
      setup() {
        const el = ref<HTMLTextAreaElement>();
        api = useSafeType(el, { mode: "block" });
        return { el, message: api.message };
      },
      template: `<textarea aria-label="u" ref="el"></textarea><p v-if="message">{{ message.text }}</p>`,
    });
    await nextTick();
    await userEvent.type(field("u"), "shit");
    await nextTick();
    expect(api!.result.value?.action).toBe("block");
    expect(document.querySelector("p")!.textContent).toMatch(/can't be sent/);
    expect(api!.validate().valid).toBe(false);
    expect(document.querySelector(".safetype-message")).toBeNull();
  });

  it("useModeration is reactive", async () => {
    const text = ref("What the fuck");
    let result: ReturnType<typeof useModeration> | undefined;
    mountApp({
      setup() {
        result = useModeration(text, { mode: "suggest" });
        return () => null;
      },
    });
    expect(result!.value.suggestedText).toBe("What the heck");
    text.value = "all good";
    expect(result!.value.matches).toEqual([]);
  });

  it("stops moderating after the component unmounts", async () => {
    const onModerated = vi.fn();
    const wrapper = mountApp({
      setup() {
        const el = ref<HTMLInputElement>();
        useSafeType(el, { onModerated });
        return { el };
      },
      template: `<input aria-label="x" ref="el">`,
    });
    await nextTick();
    const input = field("x");
    wrapper.unmount();
    wrappers.pop();
    document.body.append(input);
    input.value = "shit ";
    input.dispatchEvent(new InputEvent("input", { inputType: "insertText" }));
    await tick();
    expect(onModerated).not.toHaveBeenCalled();
    expect(input.value).toBe("shit ");
  });
});
