import type { MaskStyle, ModerationAction, ModerationEngine, ModerationResult, ModerationRule, PolicyMap, ModerationCategory, DictionaryPack, ContextualClassifier } from "@safetype/core";
import type { MessageLevel, MessageText } from "@safetype/dom";
import { defineComponent, h, ref, type PropType } from "vue";
import { useSafeType } from "./use-safe-type";

const MESSAGE_STYLE: Record<MessageLevel, Record<string, string>> = {
  warn: { display: "block", marginTop: "4px", fontSize: "0.875em", lineHeight: "1.4", color: "#8a5300" },
  block: { display: "block", marginTop: "4px", fontSize: "0.875em", lineHeight: "1.4", color: "#b42318" },
};

const optionalBoolean = { type: Boolean, default: undefined } as const;

const fieldProps = {
  modelValue: String,
  mode: String as PropType<ModerationAction>,
  language: String,
  categories: Array as PropType<ModerationCategory[]>,
  policy: Object as PropType<PolicyMap>,
  packs: Array as PropType<DictionaryPack[]>,
  customWords: Array as PropType<string[]>,
  allowList: Array as PropType<string[]>,
  rules: Array as PropType<ModerationRule[]>,
  maskChar: String,
  maskStyle: [String, Function] as PropType<MaskStyle>,
  detectSpacedLetters: optionalBoolean,
  classifiers: Array as PropType<ContextualClassifier[]>,
  classifierTimeoutMs: Number,
  engine: Object as PropType<ModerationEngine>,
  messages: Object as PropType<Partial<Record<MessageLevel, MessageText>>>,
  /** Render the built-in accessible message under the field. */
  showMessage: { type: Boolean, default: true },
  /** Skip the default inline message styles (style `.safetype-message` yourself). */
  unstyled: Boolean,
  blockSubmit: optionalBoolean,
  asyncModeration: optionalBoolean,
  asyncDebounceMs: Number,
};

let nextId = 0;

function createField(tag: "input" | "textarea", name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: fieldProps,
    emits: {
      "update:modelValue": (_value: string) => true,
      moderation: (_result: ModerationResult) => true,
      violation: (_result: ModerationResult) => true,
      warning: (_result: ModerationResult) => true,
      blocked: (_result: ModerationResult) => true,
      moderationError: (_error: unknown) => true,
    },
    setup(props, { emit, attrs, expose }) {
      const el = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
      const safeType = useSafeType(el, () => ({
        mode: props.mode,
        language: props.language,
        categories: props.categories,
        policy: props.policy,
        packs: props.packs,
        customWords: props.customWords,
        allowList: props.allowList,
        rules: props.rules,
        maskChar: props.maskChar,
        maskStyle: props.maskStyle,
        detectSpacedLetters: props.detectSpacedLetters,
        classifiers: props.classifiers,
        classifierTimeoutMs: props.classifierTimeoutMs,
        engine: props.engine,
        messages: props.messages,
        blockSubmit: props.blockSubmit,
        asyncModeration: props.asyncModeration,
        asyncDebounceMs: props.asyncDebounceMs,
        showMessages: false,
        onModerated: (result) => emit("moderation", result),
        onViolation: (result) => emit("violation", result),
        onWarning: (result) => emit("warning", result),
        onBlocked: (result) => emit("blocked", result),
        onError: (error) => emit("moderationError", error),
      }));
      const messageId = `safetype-message-v${++nextId}`;

      expose({
        el,
        result: safeType.result,
        validate: safeType.validate,
        focus: () => el.value?.focus(),
      });

      return () => {
        const message = props.showMessage ? safeType.message.value : null;
        const describedBy = [attrs["aria-describedby"], message ? messageId : null].filter(Boolean).join(" ") || undefined;
        const userOnInput = attrs.onInput as ((event: Event) => void) | undefined;
        const field = h(tag, {
          ...attrs,
          ref: el,
          ...(props.modelValue !== undefined ? { value: props.modelValue } : {}),
          "aria-describedby": describedBy,
          "aria-invalid": safeType.message.value?.level === "block" ? "true" : attrs["aria-invalid"],
          onInput: (event: Event) => {
            emit("update:modelValue", (event.target as HTMLInputElement).value);
            userOnInput?.(event);
          },
        });
        if (!props.showMessage) return field;
        // The live region is always rendered so screen readers announce the message when it appears.
        const live = h(
          "span",
          {
            id: messageId,
            class: "safetype-message",
            "data-level": message?.level,
            role: "status",
            "aria-live": "polite",
            style: props.unstyled || !message ? undefined : MESSAGE_STYLE[message.level],
          },
          message?.text ?? "",
        );
        return [field, live];
      };
    },
  });
}

/** `<input>` with live moderation; use with `v-model`. Other attributes and listeners pass through. */
export const SafeTypeInput = createField("input", "SafeTypeInput");
/** `<textarea>` with live moderation; use with `v-model`. */
export const SafeTypeTextarea = createField("textarea", "SafeTypeTextarea");
