import type { ModerationAction, ModerationResult, PolicyMap } from "@safetype/core";
import { createSafeTypeEditor, type EditorChange, type SafeTypeEditor as EditorApi, type SafeTypeEditorOptions, type ToolbarItem } from "@safetype/editor";
import { createComponent, createEffect, on, onCleanup, onMount, untrack, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export type { EditorChange, SafeTypeEditorOptions };
export type SafeTypeEditorHandle = EditorApi;

export interface SafeTypeEditorProps {
  /** HTML content. Changes from outside replace the content; edits come back through `onValueChange`. */
  value?: string;
  onValueChange?: (html: string) => void;
  mode?: ModerationAction;
  policy?: PolicyMap;
  placeholder?: string;
  label?: string;
  toolbar?: ToolbarItem[] | false;
  maxLength?: number;
  theme?: "light" | "dark" | "auto";
  name?: string;
  editable?: boolean;
  customWords?: string[];
  /** Any other `createSafeTypeEditor` options (read on mount). */
  options?: Partial<Omit<SafeTypeEditorOptions, "element">>;
  onChange?: (change: EditorChange) => void;
  onModeration?: (result: ModerationResult) => void;
  onViolation?: (result: ModerationResult) => void;
  onWarning?: (result: ModerationResult) => void;
  onBlocked?: (result: ModerationResult) => void;
  /** Receives the editor API (`validate()`, `applySuggestions()`, `focus()`, ...) once mounted. */
  apiRef?: (editor: SafeTypeEditorHandle) => void;
  class?: string;
}

/**
 * Rich-text editor with live moderation (Tiptap). `value`, `mode`, `policy` and `editable` update
 * live; other options are read on mount.
 *
 * ```tsx
 * import { SafeTypeEditor } from "@safetype/solid/editor";
 * <SafeTypeEditor value={html()} onValueChange={setHtml} mode="mask" placeholder="Write something..." />
 * ```
 */
export function SafeTypeEditor(props: SafeTypeEditorProps): JSX.Element {
  let host: HTMLDivElement | undefined;
  let api: EditorApi | null = null;

  onMount(() => {
    const defined = untrack(() =>
      Object.fromEntries(
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
      ),
    );
    api = createSafeTypeEditor({
      ...untrack(() => props.options),
      ...defined,
      element: host!,
      content: untrack(() => props.value ?? props.options?.content ?? ""),
      onChange: (change) => {
        props.onValueChange?.(change.html);
        props.onChange?.(change);
      },
      onModerated: (result) => props.onModeration?.(result),
      onViolation: (result) => props.onViolation?.(result),
      onWarning: (result) => props.onWarning?.(result),
      onBlocked: (result) => props.onBlocked?.(result),
    });
    props.apiRef?.(api);
  });

  onCleanup(() => {
    api?.destroy();
    api = null;
  });

  createEffect(
    on(
      () => props.value,
      (value) => {
        if (api && value !== undefined && value !== api.getHTML()) api.setContent(value);
      },
      { defer: true },
    ),
  );
  createEffect(on(() => props.mode, (mode) => mode && api?.setMode(mode), { defer: true }));
  createEffect(
    on(
      () => JSON.stringify(props.policy ?? null),
      () => props.policy && api?.setPolicy(props.policy),
      { defer: true },
    ),
  );
  createEffect(on(() => props.editable, (editable) => editable !== undefined && api?.setEditable(editable), { defer: true }));

  return createComponent(Dynamic, {
    component: "div",
    ref: (el: HTMLDivElement) => (host = el),
    get class() {
      return props.class;
    },
  });
}
