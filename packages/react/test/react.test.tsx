import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createModerationEngine } from "@safetype/core";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeTypeInput, SafeTypeProvider, SafeTypeTextarea, useModeration, useSafeType, useSafeTypeEngine } from "../src";

afterEach(cleanup);

function Controlled({ onValue, ...props }: { onValue?: (v: string) => void } & Parameters<typeof SafeTypeInput>[0]) {
  const [value, setValue] = useState("");
  return (
    <>
      <SafeTypeInput
        aria-label="message"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValue?.(e.target.value);
        }}
        {...props}
      />
      <div data-testid="state">{value}</div>
    </>
  );
}

describe("<SafeTypeInput>", () => {
  it("masks while typing and keeps React state in sync (controlled)", async () => {
    render(<Controlled />);
    const input = screen.getByLabelText("message") as HTMLInputElement;
    await userEvent.type(input, "What the fuck are you doing?");
    expect(input.value).toBe("What the f*ck are you doing?");
    expect(screen.getByTestId("state").textContent).toBe("What the f*ck are you doing?");
  });

  it("keeps the caret where the user is typing", async () => {
    render(<Controlled />);
    const input = screen.getByLabelText("message") as HTMLInputElement;
    await userEvent.type(input, "hello world");
    input.setSelectionRange(0, 0);
    await userEvent.type(input, "fuck ", { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(input.value).toBe("f*ck hello world");
    expect(input.selectionStart).toBe(5);
    expect(screen.getByTestId("state").textContent).toBe("f*ck hello world");
  });

  it("does not mask a word that is still being typed", async () => {
    render(<Controlled />);
    const input = screen.getByLabelText("message") as HTMLInputElement;
    await userEvent.type(input, "the assassin");
    expect(input.value).toBe("the assassin");
  });

  it("works uncontrolled and forwards refs", async () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<SafeTypeInput aria-label="u" ref={ref} defaultValue="" />);
    await userEvent.type(screen.getByLabelText("u"), "oh shit ");
    expect(ref.current?.value).toBe("oh sh*t ");
  });

  it("supports callback refs", async () => {
    const seen: (HTMLInputElement | null)[] = [];
    render(<SafeTypeInput aria-label="cb" ref={(el) => seen.push(el)} />);
    expect(seen[0]).toBeInstanceOf(HTMLInputElement);
  });

  it("renders an accessible warning linked to the field", async () => {
    render(<Controlled aria-describedby="hint" />);
    const input = screen.getByLabelText("message");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    await userEvent.type(input, "you are an idiot ");
    expect(status.textContent).toMatch(/hurtful/);
    expect(status.getAttribute("data-level")).toBe("warn");
    expect(input.getAttribute("aria-describedby")).toBe(`hint ${status.id}`);
    await userEvent.clear(input);
    await userEvent.type(input, "you are great ");
    expect(status.textContent).toBe("");
    expect(input.getAttribute("aria-describedby")).toBe("hint");
  });

  it("supports custom messages and hiding the message", async () => {
    const { unmount } = render(<SafeTypeInput aria-label="m" mode="block" messages={{ block: "Nope" }} />);
    await userEvent.type(screen.getByLabelText("m"), "shit ");
    expect(screen.getByRole("status").textContent).toBe("Nope");
    expect(screen.getByLabelText("m").getAttribute("aria-invalid")).toBe("true");
    unmount();
    render(<SafeTypeInput aria-label="m2" mode="block" showMessage={false} />);
    await userEvent.type(screen.getByLabelText("m2"), "shit ");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("blocks the form's onSubmit in block mode and lets clean text through", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault());
    const onBlocked = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Controlled mode="block" onBlocked={onBlocked} />
        <button>Send</button>
      </form>,
    );
    const input = screen.getByLabelText("message");
    await userEvent.type(input, "this is shit");
    await userEvent.click(screen.getByText("Send"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    await userEvent.clear(input);
    await userEvent.type(input, "this is fine");
    await userEvent.click(screen.getByText("Send"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("updates the mode live", async () => {
    function Switchable() {
      const [mode, setMode] = useState<"mask" | "warn">("warn");
      return (
        <>
          <SafeTypeInput aria-label="s" mode={mode} />
          <button onClick={() => setMode("mask")}>mask</button>
        </>
      );
    }
    render(<Switchable />);
    const input = screen.getByLabelText("s") as HTMLInputElement;
    await userEvent.type(input, "shit ");
    expect(input.value).toBe("shit ");
    await userEvent.click(screen.getByText("mask"));
    await userEvent.type(input, "shit ");
    expect(input.value).toBe("sh*t sh*t ");
  });

  it("calls onModeration and onViolation", async () => {
    const onModeration = vi.fn();
    const onViolation = vi.fn();
    render(<SafeTypeInput aria-label="e" onModeration={onModeration} onViolation={onViolation} />);
    await userEvent.type(screen.getByLabelText("e"), "shit ok");
    expect(onModeration).toHaveBeenCalled();
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate listeners in StrictMode", async () => {
    const onModeration = vi.fn();
    render(
      <StrictMode>
        <SafeTypeInput aria-label="strict" onModeration={onModeration} />
      </StrictMode>,
    );
    fireEvent.input(screen.getByLabelText("strict"), { target: { value: "hi" } });
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(onModeration).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", async () => {
    const onModeration = vi.fn();
    const { unmount } = render(<SafeTypeInput aria-label="gone" onModeration={onModeration} />);
    const input = screen.getByLabelText("gone");
    unmount();
    document.body.append(input);
    fireEvent.input(input, { target: { value: "shit " } });
    await new Promise((r) => setTimeout(r, 10));
    expect(onModeration).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("shit ");
    input.remove();
  });
});

describe("<SafeTypeTextarea>", () => {
  it("masks multi-line text", async () => {
    render(<SafeTypeTextarea aria-label="t" />);
    const textarea = screen.getByLabelText("t") as HTMLTextAreaElement;
    await userEvent.type(textarea, "line one shit{enter}line two");
    expect(textarea.value).toBe("line one sh*t\nline two");
  });
});

describe("<SafeTypeProvider>", () => {
  it("shares configuration such as custom words", async () => {
    render(
      <SafeTypeProvider customWords={["frak"]}>
        <SafeTypeInput aria-label="a" />
        <SafeTypeTextarea aria-label="b" />
      </SafeTypeProvider>,
    );
    await userEvent.type(screen.getByLabelText("a"), "frak ");
    await userEvent.type(screen.getByLabelText("b"), "frak ");
    expect((screen.getByLabelText("a") as HTMLInputElement).value).toBe("fr*k ");
    expect((screen.getByLabelText("b") as HTMLTextAreaElement).value).toBe("fr*k ");
  });

  it("lets a component override the mode while inheriting provider config", async () => {
    render(
      <SafeTypeProvider customWords={["frak"]}>
        <SafeTypeInput aria-label="w" mode="warn" />
      </SafeTypeProvider>,
    );
    await userEvent.type(screen.getByLabelText("w"), "frak ");
    expect((screen.getByLabelText("w") as HTMLInputElement).value).toBe("frak ");
    expect(screen.getByRole("status").getAttribute("data-level")).toBe("warn");
  });

  it("exposes the shared engine", () => {
    const engine = createModerationEngine();
    let seen: unknown;
    function Probe() {
      seen = useSafeTypeEngine();
      return null;
    }
    render(
      <SafeTypeProvider engine={engine}>
        <Probe />
      </SafeTypeProvider>,
    );
    expect(seen).toBe(engine);
  });
});

describe("hooks", () => {
  it("useModeration moderates strings during render", () => {
    function Preview({ text }: { text: string }) {
      const result = useModeration(text, { mode: "suggest" });
      return <p data-testid="p">{result.suggestedText}</p>;
    }
    const { rerender } = render(<Preview text="What the fuck" />);
    expect(screen.getByTestId("p").textContent).toBe("What the heck");
    rerender(<Preview text="all good" />);
    expect(screen.getByTestId("p").textContent).toBe("all good");
  });

  it("useSafeType attaches to custom elements and exposes result, message and validate()", async () => {
    let api: ReturnType<typeof useSafeType<HTMLTextAreaElement>> | undefined;
    function Custom() {
      const safeType = useSafeType<HTMLTextAreaElement>({ mode: "block" });
      api = safeType;
      return (
        <>
          <textarea aria-label="c" ref={safeType.ref} />
          {safeType.message && <em>{safeType.message.text}</em>}
        </>
      );
    }
    render(<Custom />);
    const textarea = screen.getByLabelText("c") as HTMLTextAreaElement;
    await userEvent.type(textarea, "shit");
    expect(api!.result?.action).toBe("block");
    expect(screen.getByText(/can't be sent/)).toBeTruthy();
    let outcome: ReturnType<NonNullable<typeof api>["validate"]> | undefined;
    act(() => {
      outcome = api!.validate();
    });
    expect(outcome!.valid).toBe(false);
    // useSafeType does not render DOM messages itself
    expect(document.querySelector(".safetype-message")).toBeNull();
  });

  it("useSafeType works with contenteditable", async () => {
    function Editor() {
      const { ref } = useSafeType<HTMLDivElement>();
      const inner = useRef<HTMLDivElement | null>(null);
      return (
        <div
          aria-label="ed"
          contentEditable
          suppressContentEditableWarning
          ref={(n) => {
            inner.current = n;
            ref(n);
          }}
        >
          <b>fuck</b> this
        </div>
      );
    }
    render(<Editor />);
    const editor = screen.getByLabelText("ed");
    fireEvent.focusOut(editor);
    expect(editor.innerHTML).toBe("<b>f*ck</b> this");
  });
});
