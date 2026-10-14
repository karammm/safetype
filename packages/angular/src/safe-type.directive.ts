import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  booleanAttribute,
  inject,
  type OnChanges,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import type { ModerationAction, ModerationEngine, ModerationResult, PolicyMap } from "@safetype/core";
import { createSafeType, type MessageLevel, type MessageText, type SafeTypeInstance } from "@safetype/dom";
import { SafeTypeService, type SafeTypeEngineOptions } from "./safe-type.service";

export interface SafeTypeDirectiveOptions extends SafeTypeEngineOptions {
  messages?: Partial<Record<MessageLevel, MessageText>>;
  showMessages?: boolean;
  blockSubmit?: boolean;
  asyncModeration?: boolean;
  asyncDebounceMs?: number;
}

const MODES = new Set(["allow", "mask", "suggest", "warn", "block"]);

/**
 * Live moderation for `<input>`, `<textarea>` and contenteditable elements.
 * Works with `ngModel`, `formControl` and `formControlName`: the form value receives the masked text.
 *
 * ```html
 * <textarea safeType [(ngModel)]="text"></textarea>
 * <input safeType safeTypeMode="block" [formControl]="title" #st="safeType">
 * ```
 */
@Directive({
  selector: "[safeType]",
  standalone: true,
  exportAs: "safeType",
})
export class SafeTypeDirective implements OnInit, OnChanges, OnDestroy {
  /** Options object, or a mode (`safeType="warn"`). Empty uses the app configuration. */
  @Input() safeType: SafeTypeDirectiveOptions | ModerationAction | "" | null | undefined;
  @Input() safeTypeMode?: ModerationAction;
  @Input() safeTypePolicy?: PolicyMap;
  @Input() safeTypeMessages?: Partial<Record<MessageLevel, MessageText>>;
  /** Render the accessible message after the element. Default true. */
  @Input({ transform: booleanAttribute }) safeTypeShowMessages = true;
  @Input() safeTypeBlockSubmit?: boolean;

  @Output() readonly safeTypeModerated = new EventEmitter<ModerationResult>();
  /** Emits when the set of violations changes (not on every keystroke). */
  @Output() readonly safeTypeViolation = new EventEmitter<ModerationResult>();
  @Output() readonly safeTypeWarning = new EventEmitter<ModerationResult>();
  /** Emits when a form submission is prevented. */
  @Output() readonly safeTypeBlocked = new EventEmitter<ModerationResult>();
  @Output() readonly safeTypeError = new EventEmitter<unknown>();

  /** Latest moderation result (available through `#ref="safeType"`). */
  result: ModerationResult | undefined;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(SafeTypeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private instance: SafeTypeInstance | null = null;
  private engine!: ModerationEngine;
  private owned = false;

  private options(): SafeTypeDirectiveOptions {
    const value = this.safeType;
    const options: SafeTypeDirectiveOptions =
      typeof value === "string" ? (MODES.has(value) ? { mode: value as ModerationAction } : {}) : { ...value };
    if (this.safeTypeMode) options.mode = this.safeTypeMode;
    if (this.safeTypePolicy) options.policy = this.safeTypePolicy;
    return options;
  }

  ngOnInit(): void {
    const options = this.options();
    ({ engine: this.engine, owned: this.owned } = this.service.resolve(options));
    const messages = () => this.safeTypeMessages ?? this.options().messages;
    this.instance = createSafeType({
      engine: this.engine,
      root: this.host.nativeElement,
      observeDynamicElements: false,
      showMessages: options.showMessages ?? this.safeTypeShowMessages,
      messages: {
        get warn() {
          return messages()?.warn;
        },
        get block() {
          return messages()?.block;
        },
      },
      blockSubmit: this.safeTypeBlockSubmit ?? options.blockSubmit,
      asyncModeration: options.asyncModeration,
      asyncDebounceMs: options.asyncDebounceMs,
      onModerated: (result) => {
        this.result = result;
        this.safeTypeModerated.emit(result);
        this.cdr.markForCheck();
      },
      onViolation: (result) => this.safeTypeViolation.emit(result),
      onWarning: (result) => this.safeTypeWarning.emit(result),
      onBlocked: (result) => this.safeTypeBlocked.emit(result),
      onError: (error) => {
        if (this.safeTypeError.observed) this.safeTypeError.emit(error);
        else console.error("[safetype]", error);
      },
    });
    this.instance.start();
  }

  ngOnChanges(): void {
    if (!this.instance || !this.owned) return;
    const { mode, policy } = this.options();
    if (mode) this.engine.setMode(mode);
    if (policy) this.engine.setPolicy(policy);
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  /** Final pass (masks pending words). `valid` is false when the content is blocked. */
  validate(): { valid: boolean; result: ModerationResult | undefined } {
    const outcome = this.instance?.validate();
    const result = outcome?.results[0]?.result;
    if (result) this.result = result;
    return { valid: outcome?.valid ?? true, result };
  }
}
