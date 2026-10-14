import { Component, ViewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { afterEach, describe, expect, it } from "vitest";
import { SafeTypeEditorComponent } from "../editor/src/public-api";

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = "";
});

function typeInto(component: SafeTypeEditorComponent, text: string) {
  const { editor } = component.api!;
  editor.commands.focus("end");
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

describe("<safe-type-editor> (Angular)", () => {
  it("works as a reactive form control: masked HTML in, writeValue out, disabled state", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeEditorComponent, ReactiveFormsModule],
      template: `<safe-type-editor [formControl]="body" placeholder="Write..." />`,
    })
    class Host {
      @ViewChild(SafeTypeEditorComponent) editor!: SafeTypeEditorComponent;
      body = new FormControl("<p>start</p>", { nonNullable: true });
    }
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    expect(host.editor.api!.getHTML()).toBe("<p>start</p>");
    typeInto(host.editor, " what the fuck now");
    expect(host.body.value).toBe("<p>start what the f*ck now</p>");
    host.body.setValue("<p>reset</p>");
    expect(host.editor.api!.getHTML()).toBe("<p>reset</p>");
    host.body.disable();
    expect(host.editor.api!.editor.isEditable).toBe(false);
    fixture.destroy();
    expect(document.querySelector(".safetype-editor")).toBeNull();
  });

  it("works with ngModel and emits moderation outputs", async () => {
    @Component({
      standalone: true,
      imports: [SafeTypeEditorComponent, FormsModule],
      template: `<safe-type-editor [(ngModel)]="html" mode="warn" (warning)="warnings = warnings + 1" />`,
    })
    class Host {
      @ViewChild(SafeTypeEditorComponent) editor!: SafeTypeEditorComponent;
      html = "";
      warnings = 0;
    }
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    typeInto(fixture.componentInstance.editor, "you are an idiot");
    expect(fixture.componentInstance.html).toBe("<p>you are an idiot</p>");
    expect(fixture.componentInstance.warnings).toBe(1);
    fixture.destroy();
  });
});
