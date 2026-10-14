import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { SafeTypeInput, SafeTypeTextarea } from "../src";
import { SafeTypeEditor } from "../src/editor";

const mode = (new URLSearchParams(location.search).get("mode") ?? "mask") as "mask" | "block";
const w = window as unknown as { submitted: number; renders: number };
w.submitted = 0;
w.renders = 0;

function App() {
  const [text, setText] = useState("");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState("<p></p>");
  w.renders++;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        w.submitted++;
      }}
    >
      <SafeTypeInput aria-label="controlled" mode={mode} value={text} onChange={(e) => setText(e.target.value)} />
      <div data-testid="state">{text}</div>
      <SafeTypeTextarea aria-label="body" mode={mode} value={body} onChange={(e) => setBody(e.target.value)} />
      <div data-testid="body-state">{body}</div>
      <SafeTypeEditor value={html} onChange={setHtml} label="rich" toolbar={["bold"]} />
      <div data-testid="html-state">{html}</div>
      <button type="submit">Send</button>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
