import userEvent from "@testing-library/user-event";
import { createComponent, createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import {
  safeType,
  SafeTypeInput,
  SafeTypeProvider,
  SafeTypeTextarea,
  useModeration,
  useSafeType,
  useSafeTypeEngine,
  type SafeTypeFieldApi,
} from "../src";

const disposers: (() => void)[] = [];
function mount(view: () => JSX.Element): () => void {
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(view, container);
  disposers.push(dispose);
  return dispose;
}
afterEach(() => {
  while (disposers.length) disposers.pop()!();
  document.body.innerHTML = "";
});

const field = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("<SafeTypeInput> / <SafeTypeTextarea>", () => {
  it("masks while typing and reports the masked text", async () => {
    const [text, setText] = createSignal("");
    mount(() => createComponent(SafeTypeInput, { "aria-label": "in", get value() { return text(); }, onValueChange: setText }));
    await userEvent.type(field("in"), "What the fuck are you doing?");
    expect(field("in").value).toBe("What the f*ck are you doing?");
    expect(text()).toBe("What the f*ck are you doing?");
  });

  it("does not mask unfinished words or innocent ones", async () => {
    mount(() => createComponent(SafeTypeTextarea, { "aria-label": "ta" }));
    await userEvent.type(field("ta"), "the assassin from Scunthorpe");
    expect(field("ta").value).toBe("the assassin from Scunthorpe");
    expect(field("ta").getAttribute("value")).toBeNull();
  });

  it("shows an accessible warning in warn mode", async () => {
    mount(() => createComponent(SafeTypeInput, { "aria-label": "w", mode: "warn" }));
    await userEvent.type(field("w"), "you are an idiot ");
    const live = field("w").nextElementSibling as HTMLElement;
    expect(field("w").value).toBe("you are an idiot ");
    expect(live.getAttribute("role")).toBe("status");
    expect(live.dataset.level).toBe("warn");
    expect(live.textContent).not.toBe("");
    expect(field("w").getAttribute("aria-describedby")).toBe(live.id);
  });

  it("marks blocked content invalid and validate() reports it", async () => {
    let api!: SafeTypeFieldApi;
    mount(() => createComponent(SafeTypeInput, { "aria-label": "b", mode: "block", apiRef: (a) => (api = a) }));
    await userEvent.type(field("b"), "shit ");
    expect(field("b").getAttribute("aria-invalid")).toBe("true");
    expect(api.validate().valid).toBe(false);
    expect(api.message()?.level).toBe("block");
  });

  it("updates the mode live from a signal", async () => {
    const [mode, setMode] = createSignal<"warn" | "mask">("warn");
    mount(() => createComponent(SafeTypeInput, { "aria-label": "live", get mode() { return mode(); } }));
    await userEvent.type(field("live"), "shit ");
    expect(field("live").value).toBe("shit ");
    setMode("mask");
    await userEvent.type(field("live"), "fuck ");
    expect(field("live").value).toBe("sh*t f*ck ");
  });

  it("passes other props through and calls the user's onInput", async () => {
    const seen: string[] = [];
    mount(() =>
      createComponent(SafeTypeInput, {
        "aria-label": "p",
        placeholder: "Say hi",
        class: "mine",
        showMessage: false,
        onInput: (e: Event) => seen.push((e.target as HTMLInputElement).value),
      }),
    );
    expect(field("p").placeholder).toBe("Say hi");
    expect(field("p").className).toBe("mine");
    expect(field("p").nextElementSibling).toBeNull();
    await userEvent.type(field("p"), "ok");
    expect(seen).toEqual(["o", "ok"]);
  });

  it("removes its message and stops moderating when disposed", async () => {
    const dispose = mount(() => createComponent(SafeTypeInput, { "aria-label": "d", mode: "warn" }));
    const input = field("d");
    dispose();
    document.body.append(input);
    await userEvent.type(input, "fuck ");
    expect(input.value).toBe("fuck ");
    expect(document.querySelector(".safetype-message")).toBeNull();
  });
});

describe("use:safeType directive", () => {
  const withDirective = (label: string, value: Parameters<typeof safeType>[1]) => () => {
    const el = document.createElement("textarea");
    el.setAttribute("aria-label", label);
    safeType(el, value);
    return el;
  };

  it("masks with defaults and accepts a mode or options", async () => {
    mount(withDirective("plain", () => true));
    mount(withDirective("warn", () => "warn"));
    mount(withDirective("custom", () => ({ customWords: ["frak"] })));
    await userEvent.type(field("plain"), "fuck ");
    await userEvent.type(field("warn"), "shit ");
    await userEvent.type(field("custom"), "frak ");
    expect(field("plain").value).toBe("f*ck ");
    expect(field("warn").value).toBe("shit ");
    expect(field("warn").nextElementSibling?.getAttribute("data-level")).toBe("warn");
    expect(field("custom").value).toBe("fr*k ");
  });

  it("follows a reactive mode", async () => {
    const [mode, setMode] = createSignal<"warn" | "block">("warn");
    mount(withDirective("rm", () => ({ mode: mode() })));
    setMode("block");
    await tick();
    await userEvent.type(field("rm"), "shit ");
    expect(field("rm").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("primitives", () => {
  it("useModeration is reactive", () => {
    const [text, setText] = createSignal("hello");
    let result!: ReturnType<typeof useModeration>;
    mount(() => {
      result = useModeration(text);
      return document.createElement("div");
    });
    expect(result().action).toBe("allow");
    setText("what the fuck");
    expect(result().text).toBe("what the f*ck");
  });

  it("useSafeType attaches to an element from a signal", async () => {
    let hook!: ReturnType<typeof useSafeType>;
    mount(() => {
      const [el, setEl] = createSignal<HTMLInputElement>();
      hook = useSafeType(el, { mode: "warn" });
      const input = document.createElement("input");
      input.setAttribute("aria-label", "u");
      setEl(input);
      return input;
    });
    await tick();
    await userEvent.type(field("u"), "you idiot ");
    expect(hook.result()?.action).toBe("warn");
    expect(hook.message()?.level).toBe("warn");
    expect(field("u").nextElementSibling).toBeNull(); // messages are yours to render
  });

  it("<SafeTypeProvider> shares one engine and its configuration", async () => {
    let engineA: unknown;
    let engineB: unknown;
    mount(() =>
      createComponent(SafeTypeProvider, {
        customWords: ["frak"],
        get children() {
          engineA = useSafeTypeEngine();
          return [
            createComponent(SafeTypeInput, { "aria-label": "shared" }),
            createComponent(SafeTypeInput, { "aria-label": "own", mode: "warn" }),
            (() => {
              engineB = useSafeTypeEngine();
              return null;
            })(),
          ];
        },
      }),
    );
    expect(engineA).toBeDefined();
    expect(engineA).toBe(engineB);
    await userEvent.type(field("shared"), "frak ");
    await userEvent.type(field("own"), "frak ");
    expect(field("shared").value).toBe("fr*k ");
    // A private engine (own options) still inherits the provider's custom words.
    expect(field("own").value).toBe("frak ");
    expect(field("own").nextElementSibling?.getAttribute("data-level")).toBe("warn");
  });
});
