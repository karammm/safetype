import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { expect, it } from "vitest";
import { safeType, SafeTypeInput, SafeTypeProvider, useModeration } from "../src";
void safeType;

it("works from Solid JSX, including use:safeType on a fresh element", async () => {
  const [text, setText] = createSignal("");
  const [mode, setMode] = createSignal<"mask" | "warn">("mask");
  let preview!: () => string;
  function App() {
    const r = useModeration(text);
    preview = () => r().text;
    return (
      <SafeTypeProvider customWords={["frak"]}>
        <SafeTypeInput aria-label="a" value={text()} onValueChange={setText} mode={mode()} />
        <textarea aria-label="b" use:safeType={{ mode: "warn" }} />
      </SafeTypeProvider>
    );
  }
  render(() => <App />, document.body);
  const a = document.querySelector('[aria-label="a"]') as HTMLInputElement;
  const b = document.querySelector('[aria-label="b"]') as HTMLTextAreaElement;
  await userEvent.type(a, "frak this fuck ");
  expect(a.value).toBe("fr*k this f*ck ");
  expect(text()).toBe("fr*k this f*ck ");
  expect(preview()).toBe("fr*k this f*ck ");
  setMode("warn");
  await userEvent.type(a, "shit ");
  // user-event replays its own copy of the typed text, so check only the new word stays unmasked.
  expect(a.value.endsWith("shit ")).toBe(true);
  expect(text()).toBe(a.value);
  await userEvent.type(b, "frak ");
  expect(b.value).toBe("frak ");
  expect(b.nextElementSibling?.getAttribute("data-level")).toBe("warn");
});
