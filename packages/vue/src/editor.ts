import type { ModerationAction, ModerationResult, PolicyMap } from "@safetype/core";
import { createSafeTypeEditor, type EditorChange, type SafeTypeEditor as EditorApi, type SafeTypeEditorOptions, type ToolbarItem } from "@safetype/editor";
import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue";

export type { EditorChange, SafeTypeEditorOptions };
export type SafeTypeEditorHandle = EditorApi;

/**
 * Rich-text editor with live moderation (Tiptap). Use with `v-model` (HTML).
 * `mode`, `policy` and `editable` update live; other options are read on mount. Pass any other
 * `createSafeTypeEditor` option through `options`.
 *
 * ```vue
 * <SafeTypeEditor v-model="html" mode="mask" placeholder="Write something..." />
 * ```
 */
export const SafeTypeEditor = defineComponent({
  name: "SafeTypeEditor",
  props: {
    modelValue: String,
    mode: String as PropType<ModerationAction>,
    policy: Object as PropType<PolicyMap>,
    placeholder: String,
    label: String,
    toolbar: { type: [Array, Boolean] as PropType<ToolbarItem[] | false>, default: undefined },
    maxLength: Number,
    theme: String as PropType<"light" | "dark" | "auto">,
    name: String,
    editable: { type: Boolean, default: undefined },
    customWords: Array as PropType<string[]>,
    /** Any other `createSafeTypeEditor` options (read on mount). */
    options: Object as PropType<Partial<Omit<SafeTypeEditorOptions, "element">>>,
  },
  emits: {
    "update:modelValue": (_html: string) => true,
    change: (_change: EditorChange) => true,
    moderation: (_result: ModerationResult) => true,
    violation: (_result: ModerationResult) => true,
    warning: (_result: ModerationResult) => true,
    blocked: (_result: ModerationResult) => true,
  },
  setup(props, { emit, expose }) {
    const host = ref<HTMLDivElement | null>(null);
    const api = shallowRef<EditorApi | null>(null);

    onMounted(() => {
      const defined = Object.fromEntries(
        Object.entries({
          mode: props.mode,
          policy: props.policy,
          placeholder: props.placeholder,
          label: props.label,
          toolbar: props.toolbar,
          maxLength: props.maxLength,
          theme: props.theme,
          name: props.name,
          editable: props.editable,
          customWords: props.customWords,
        }).filter(([, v]) => v !== undefined),
      );
      api.value = createSafeTypeEditor({
        ...props.options,
        ...defined,
        element: host.value!,
        content: props.modelValue ?? props.options?.content ?? "",
        onChange: (change) => {
          emit("update:modelValue", change.html);
          emit("change", change);
        },
        onModerated: (result) => emit("moderation", result),
        onViolation: (result) => emit("violation", result),
        onWarning: (result) => emit("warning", result),
        onBlocked: (result) => emit("blocked", result),
      });
    });

    onBeforeUnmount(() => {
      api.value?.destroy();
      api.value = null;
    });

    watch(
      () => props.modelValue,
      (value) => {
        if (api.value && value !== undefined && value !== api.value.getHTML()) api.value.setContent(value);
      },
    );
    watch(
      () => props.mode,
      (mode) => mode && api.value?.setMode(mode),
    );
    watch(
      () => JSON.stringify(props.policy ?? null),
      () => props.policy && api.value?.setPolicy(props.policy),
    );
    watch(
      () => props.editable,
      (editable) => editable !== undefined && api.value?.setEditable(editable),
    );

    expose({
      get editor() {
        return api.value;
      },
      validate: () => api.value?.validate(),
      applySuggestions: () => api.value?.applySuggestions() ?? 0,
      focus: () => api.value?.focus(),
    });

    return () => h("div", { ref: host });
  },
});
