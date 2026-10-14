import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeTypeEditor, type SafeTypeEditorHandle } from "../src/editor";

afterEach(cleanup);

function typeInto(handle: SafeTypeEditorHandle, text: string) {
  const { editor } = handle;
  editor.commands.focus("end");
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

describe("<SafeTypeEditor> (React)", () => {
  it("is controlled: masked HTML flows through onChange into state", () => {
    const ref = createRef<SafeTypeEditorHandle>();
    function App() {
      const [html, setHtml] = useState("<p></p>");
      return (
        <>
          <SafeTypeEditor ref={ref} value={html} onChange={setHtml} placeholder="Write..." />
          <div data-testid="state">{html}</div>
        </>
      );
    }
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    act(() => typeInto(ref.current!, "What the fuck is this"));
    expect(screen.getByTestId("state").textContent).toBe("<p>What the f*ck is this</p>");
    expect(document.querySelectorAll(".safetype-editor")).toHaveLength(1);
  });

  it("applies external value changes", () => {
    const ref = createRef<SafeTypeEditorHandle>();
    const { rerender } = render(<SafeTypeEditor ref={ref} value="<p>one</p>" />);
    expect(ref.current!.getHTML()).toBe("<p>one</p>");
    rerender(<SafeTypeEditor ref={ref} value="<p>two</p>" />);
    expect(ref.current!.getHTML()).toBe("<p>two</p>");
  });

  it("updates mode live and forwards moderation callbacks", () => {
    const ref = createRef<SafeTypeEditorHandle>();
    const onWarning = vi.fn();
    const { rerender } = render(<SafeTypeEditor ref={ref} mode="warn" defaultValue="<p>shit happens</p>" onWarning={onWarning} />);
    expect(ref.current!.getText()).toBe("shit happens");
    expect(onWarning).toHaveBeenCalledTimes(1);
    rerender(<SafeTypeEditor ref={ref} mode="mask" defaultValue="<p>shit happens</p>" />);
    act(() => void ref.current!.validate());
    expect(ref.current!.getText()).toBe("sh*t happens");
  });

  it("destroys the editor on unmount", () => {
    const { unmount } = render(<SafeTypeEditor />);
    expect(document.querySelector(".safetype-editor")).not.toBeNull();
    unmount();
    expect(document.querySelector(".safetype-editor")).toBeNull();
  });
});
