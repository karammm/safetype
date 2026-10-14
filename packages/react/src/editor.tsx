import {
  createSafeTypeEditor,
  type EditorChange,
  type SafeTypeEditor as EditorApi,
  type SafeTypeEditorOptions,
} from "@safetype/editor";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";

export type { EditorChange, SafeTypeEditorOptions };
export type SafeTypeEditorHandle = EditorApi;

export interface SafeTypeEditorProps extends Omit<SafeTypeEditorOptions, "element" | "content" | "onChange"> {
  /** Controlled HTML value. */
  value?: string;
  /** Initial HTML for uncontrolled use. */
  defaultValue?: string;
  /** Called with the HTML (and text/JSON) after each change, including masking. */
  onChange?: (html: string, change: EditorChange) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Rich-text editor with live moderation (Tiptap). `mode` and `policy` update live; other options are
 * read on mount. The ref exposes the editor API (`validate()`, `applySuggestions()`, `editor`, ...).
 *
 * ```jsx
 * <SafeTypeEditor mode="mask" placeholder="Write something..." value={html} onChange={setHtml} />
 * ```
 */
export const SafeTypeEditor = forwardRef<SafeTypeEditorHandle | null, SafeTypeEditorProps>(function SafeTypeEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [api, setApi] = useState<EditorApi | null>(null);

  useEffect(() => {
    const { value, defaultValue, onChange, className, style, ...options } = latest.current;
    const st = createSafeTypeEditor({
      ...options,
      element: host.current!,
      content: value ?? defaultValue ?? "",
      onChange: (change) => latest.current.onChange?.(change.html, change),
      onModerated: (result) => latest.current.onModerated?.(result),
      onViolation: (result) => latest.current.onViolation?.(result),
      onWarning: (result) => latest.current.onWarning?.(result),
      onBlocked: (result) => latest.current.onBlocked?.(result),
      onFocus: () => latest.current.onFocus?.(),
      onBlur: () => latest.current.onBlur?.(),
    });
    setApi(st);
    return () => {
      st.destroy();
      setApi(null);
    };
  }, []);

  useImperativeHandle(ref, () => api as EditorApi, [api]);

  const { value, mode, policy, editable } = props;
  useEffect(() => {
    if (api && value !== undefined && value !== api.getHTML()) api.setContent(value);
  }, [api, value]);
  useEffect(() => {
    if (api && mode) api.setMode(mode);
  }, [api, mode]);
  const policyKey = JSON.stringify(policy ?? null);
  useEffect(() => {
    if (api && policy) api.setPolicy(policy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, policyKey]);
  useEffect(() => {
    if (api && editable !== undefined) api.setEditable(editable);
  }, [api, editable]);

  return <div ref={host} className={props.className} style={props.style} />;
});
