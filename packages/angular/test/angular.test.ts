import { ChangeDetectionStrategy, Component, ErrorHandler, signal, type Type } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { provideSafeType, SafeTypeDirective, SafeTypePipe, SafeTypeService, safeTypeValidator } from "../src/public-api";

const fixtures: ComponentFixture<unknown>[] = [];
async function render<T>(component: Type<T>, providers: unknown[] = []) {
  TestBed.configureTestingModule({ imports: [component], providers: providers as never[] });
  const fixture = TestBed.createComponent(component);
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  fixtures.push(fixture as ComponentFixture<unknown>);
  return fixture;
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()!.destroy();
  TestBed.resetTestingModule();
  document.body.innerHTML = "";
});

const field = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;

async function settle(fixture: ComponentFixture<unknown>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe("SafeTypeDirective with forms", () => {
  it("ngModel receives the masked text", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective, FormsModule],
      template: `<input aria-label="m" safeType [(ngModel)]="text">`,
    })
    class Host {
      text = "";
    }
    const fixture = await render(Host);
    await userEvent.type(field("m"), "What the fuck are you doing?");
    await settle(fixture);
    expect(field("m").value).toBe("What the f*ck are you doing?");
    expect(fixture.componentInstance.text).toBe("What the f*ck are you doing?");
  });

  it("a reactive FormControl receives the masked text and keeps the caret", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective, ReactiveFormsModule],
      template: `<textarea aria-label="r" safeType [formControl]="control"></textarea>`,
    })
    class Host {
      control = new FormControl("");
    }
    const fixture = await render(Host);
    await userEvent.type(field("r"), "the assassin hello");
    expect(fixture.componentInstance.control.value).toBe("the assassin hello");
    field("r").setSelectionRange(0, 0);
    await userEvent.type(field("r"), "fuck ", { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(fixture.componentInstance.control.value).toBe("f*ck the assassin hello");
    expect(field("r").selectionStart).toBe(5);
  });

  it("safeTypeValidator marks blocked content invalid", async () => {
    const control = new FormControl("", safeTypeValidator());
    control.setValue("hello there");
    expect(control.valid).toBe(true);
    control.setValue("you are a worthless idiot");
    expect(control.errors?.["safeType"]).toMatchObject({ action: "block", violations: [{ category: "harassment" }] });
    const lenient = new FormControl("", safeTypeValidator({ mode: "mask" }));
    lenient.setValue("shit");
    expect(lenient.valid).toBe(true);
    const strict = new FormControl("", safeTypeValidator({ mode: "mask", errorOn: "violation" }));
    strict.setValue("shit");
    expect(strict.valid).toBe(false);
  });

  it("blocks (ngSubmit) in block mode until the text is fixed", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective, FormsModule],
      template: `<form (ngSubmit)="sent = sent + 1"><input aria-label="s" name="s" safeType="block" [(ngModel)]="text"><button>Send</button></form>`,
    })
    class Host {
      text = "";
      sent = 0;
    }
    const fixture = await render(Host);
    await userEvent.type(field("s"), "this is shit");
    await userEvent.click(document.querySelector("button")!);
    expect(fixture.componentInstance.sent).toBe(0);
    expect(field("s").getAttribute("aria-invalid")).toBe("true");
    await userEvent.clear(field("s"));
    await userEvent.type(field("s"), "this is fine");
    await userEvent.click(document.querySelector("button")!);
    expect(fixture.componentInstance.sent).toBe(1);
  });
});

describe("SafeTypeDirective inputs and outputs", () => {
  it("accepts a mode via safeType or safeTypeMode, and updates live", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<input aria-label="a" safeType="warn"><input aria-label="b" safeType [safeTypeMode]="mode()">`,
    })
    class Host {
      mode = signal<"warn" | "mask">("warn");
    }
    const fixture = await render(Host);
    await userEvent.type(field("a"), "shit ");
    await userEvent.type(field("b"), "shit ");
    expect(field("a").value).toBe("shit ");
    expect(field("a").nextElementSibling?.getAttribute("data-level")).toBe("warn");
    expect(field("b").value).toBe("shit ");
    fixture.componentInstance.mode.set("mask");
    await settle(fixture);
    await userEvent.type(field("b"), "shit ");
    expect(field("b").value).toBe("sh*t sh*t ");
  });

  it("emits outputs once per change and exposes result/validate via exportAs", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<input aria-label="o" safeType="block" #st="safeType" (safeTypeViolation)="violations = violations + 1"><p>{{ st.result?.action }}</p>`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Host {
      violations = 0;
    }
    const fixture = await render(Host);
    await userEvent.type(field("o"), "shit ok");
    await settle(fixture);
    expect(fixture.componentInstance.violations).toBe(1);
    expect(document.querySelector("p")!.textContent).toBe("block");
  });

  it("supports custom messages and hiding messages", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `
        <input aria-label="c" safeType="block" [safeTypeMessages]="{ block: 'Nope' }">
        <input aria-label="h" safeType="block" safeTypeShowMessages="false">`,
    })
    class Host {}
    await render(Host);
    await userEvent.type(field("c"), "shit ");
    await userEvent.type(field("h"), "shit ");
    const messages = document.querySelectorAll(".safetype-message");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.textContent).toBe("Nope");
  });

  it("cleans up when removed with @if", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<div id="box">@if (show()) {<input aria-label="i" safeType="warn">} @else {<p>gone</p>}<span>after</span></div>`,
    })
    class Host {
      show = signal(true);
    }
    const fixture = await render(Host);
    await userEvent.type(field("i"), "shit ");
    expect(document.querySelector(".safetype-message")).not.toBeNull();
    fixture.componentInstance.show.set(false);
    await settle(fixture);
    expect(document.querySelector(".safetype-message")).toBeNull();
    expect(document.getElementById("box")!.textContent).toBe("goneafter");
    fixture.componentInstance.show.set(true);
    await settle(fixture);
    expect(field("i")).not.toBeNull();
  });

  it("works on contenteditable and keeps formatting", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<div aria-label="ce" contenteditable="true" safeType><b>fuck</b> this</div>`,
    })
    class Host {}
    await render(Host);
    field("ce").dispatchEvent(new FocusEvent("focusout"));
    expect(field("ce").innerHTML).toBe("<b>f*ck</b> this");
  });
});

describe("provideSafeType, service and pipe", () => {
  it("shares configuration; a directive can override the mode and inherit the rest", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<input aria-label="p" safeType><input aria-label="q" safeType="warn">`,
    })
    class Host {}
    await render(Host, [provideSafeType({ customWords: ["frak"] })]);
    await userEvent.type(field("p"), "frak ");
    await userEvent.type(field("q"), "frak ");
    expect(field("p").value).toBe("fr*k ");
    expect(field("q").value).toBe("frak ");
    expect(field("q").nextElementSibling?.getAttribute("data-level")).toBe("warn");
  });

  it("SafeTypeService moderates, validates and masks", () => {
    TestBed.configureTestingModule({ providers: [provideSafeType({ mode: "block" })] });
    const service = TestBed.inject(SafeTypeService);
    expect(service.moderate("shit").action).toBe("block");
    expect(service.validate("hello").valid).toBe(true);
    expect(service.mask("oh fuck")).toBe("oh f*ck");
  });

  it("the safeType pipe masks or suggests for display", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypePipe],
      template: `<p id="m">{{ text | safeType }}</p><p id="s">{{ text | safeType: 'suggest' }}</p><p id="n">{{ missing | safeType }}</p>`,
    })
    class Host {
      text = "What the FUCK";
      missing: string | null = null;
    }
    await render(Host);
    expect(document.getElementById("m")!.textContent).toBe("What the F*CK");
    expect(document.getElementById("s")!.textContent).toBe("What the HECK");
    expect(document.getElementById("n")!.textContent).toBe("");
  });

  it("a throwing (output) handler goes to Angular's ErrorHandler and moderation keeps working", async () => {
    const handleError = vi.fn();
    @Component({
      standalone: true,
      imports: [SafeTypeDirective],
      template: `<input aria-label="e" safeType (safeTypeModerated)="boom()">`,
    })
    class Host {
      boom() {
        throw new Error("app bug");
      }
    }
    await render(Host, [{ provide: ErrorHandler, useValue: { handleError } }]);
    await userEvent.type(field("e"), "fuck ");
    expect(field("e").value).toBe("f*ck ");
    expect(handleError).toHaveBeenCalledWith(expect.objectContaining({ message: "app bug" }));
  });
});
