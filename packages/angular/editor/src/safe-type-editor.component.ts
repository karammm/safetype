import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  forwardRef,
  inject,
  type OnChanges,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from "@angular/forms";
import type { ModerationAction, ModerationResult, PolicyMap } from "@safetype/core";
import { createSafeTypeEditor, type EditorChange, type SafeTypeEditor, type SafeTypeEditorOptions, type ToolbarItem } from "@safetype/editor";

/**
 * Rich-text editor with live moderation (Tiptap). A form control: works with `ngModel`,
 * `formControl` and `formControlName` (value = HTML), or `[(value)]`.
 *
 * ```html
 * <safe-type-editor [(ngModel)]="html" mode="mask" placeholder="Write something..." />
 * ```
 */
@Component({
  selector: "safe-type-editor",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block" },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SafeTypeEditorComponent), multi: true }],
})
export class SafeTypeEditorComponent implements OnInit, OnChanges, OnDestroy, ControlValueAccessor {
  @Input() value?: string;
  @Input() mode?: ModerationAction;
  @Input() policy?: PolicyMap;
  @Input() placeholder?: string;
  @Input() label?: string;
  @Input() toolbar?: ToolbarItem[] | false;
  @Input() maxLength?: number;
  @Input() theme?: "light" | "dark" | "auto";
  @Input() name?: string;
  @Input() customWords?: string[];
  /** Any other `createSafeTypeEditor` options (read on init). */
  @Input() options?: Partial<Omit<SafeTypeEditorOptions, "element">>;

  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly editorChange = new EventEmitter<EditorChange>();
  @Output() readonly moderated = new EventEmitter<ModerationResult>();
  @Output() readonly violation = new EventEmitter<ModerationResult>();
  @Output() readonly warning = new EventEmitter<ModerationResult>();
  @Output() readonly blocked = new EventEmitter<ModerationResult>();

  /** The editor API (`validate()`, `applySuggestions()`, `editor`, ...), available after init. */
  api: SafeTypeEditor | null = null;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  // Editor events come from ProseMirror, not Angular template listeners. markForCheck() schedules
  // change detection so bindings update in zoneless apps (and is harmless with zone.js).
  private readonly cdr = inject(ChangeDetectorRef);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private pendingValue: string | undefined;
  private disabled = false;

  ngOnInit(): void {
    const defined = Object.fromEntries(
      Object.entries({
        mode: this.mode,
        policy: this.policy,
        placeholder: this.placeholder,
        label: this.label,
        toolbar: this.toolbar,
        maxLength: this.maxLength,
        theme: this.theme,
        name: this.name,
        customWords: this.customWords,
      }).filter(([, v]) => v !== undefined),
    );
    this.api = createSafeTypeEditor({
      ...this.options,
      ...defined,
      element: this.host.nativeElement,
      content: this.pendingValue ?? this.value ?? this.options?.content ?? "",
      editable: !this.disabled,
      onChange: (change) => {
        this.value = change.html;
        this.onChange(change.html);
        this.valueChange.emit(change.html);
        this.editorChange.emit(change);
        this.cdr.markForCheck();
      },
      onModerated: (result) => {
        this.moderated.emit(result);
        this.cdr.markForCheck();
      },
      onViolation: (result) => this.violation.emit(result),
      onWarning: (result) => this.warning.emit(result),
      onBlocked: (result) => this.blocked.emit(result),
      onBlur: () => this.onTouched(),
    });
  }

  ngOnChanges(): void {
    const api = this.api;
    if (!api) return;
    if (this.value !== undefined && this.value !== api.getHTML()) api.setContent(this.value);
    if (this.mode) api.setMode(this.mode);
    if (this.policy) api.setPolicy(this.policy);
  }

  ngOnDestroy(): void {
    this.api?.destroy();
    this.api = null;
  }

  // ControlValueAccessor
  writeValue(value: string | null): void {
    const html = value ?? "";
    if (!this.api) this.pendingValue = html;
    else if (html !== this.api.getHTML()) this.api.setContent(html);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.api?.setEditable(!disabled);
  }

  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(): { valid: boolean; result: ModerationResult } | undefined {
    return this.api?.validate();
  }
}
