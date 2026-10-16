// Type-checked only (not run by Vitest): the API as users write it in Solid JSX, including `use:safeType`.
import { createSignal } from "solid-js";
import { safeType, SafeTypeInput, SafeTypeProvider, SafeTypeTextarea, useModeration, type SafeTypeFieldApi } from "../src";
import { SafeTypeEditor } from "../src/editor";

void safeType; // directives are used through `use:`, which TypeScript can't see

export function Example() {
  const [text, setText] = createSignal("");
  const [html, setHtml] = createSignal("<p></p>");
  const preview = useModeration(text);
  let api: SafeTypeFieldApi | undefined;
  return (
    <SafeTypeProvider language="hi" mode="mask">
      <SafeTypeInput value={text()} onValueChange={setText} placeholder="Say something" apiRef={(a) => (api = a)} />
      <SafeTypeTextarea mode="warn" rows={4} onWarning={(r) => console.log(r.matches)} />
      <textarea use:safeType={{ mode: "block" }} />
      <input use:safeType="warn" />
      <SafeTypeEditor value={html()} onValueChange={setHtml} mode="mask" />
      <p>{preview().text}</p>
      <button onClick={() => api?.validate()}>Send</button>
    </SafeTypeProvider>
  );
}
