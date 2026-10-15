// Real-browser fixture: five third-party editors, each moderated by its SafeType adapter.
import Quill from "quill";
import { $getRoot, createEditor } from "lexical";
import { registerRichText } from "@lexical/rich-text";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { EditorState as CMState } from "@codemirror/state";
import { EditorView as CMView, keymap as cmKeymap } from "@codemirror/view";
import { defaultKeymap, history as cmHistory, historyKeymap } from "@codemirror/commands";
import * as monaco from "monaco-editor/editor/editor.api.js";
import { EditorState as PMState } from "prosemirror-state";
import { EditorView as PMView } from "prosemirror-view";
import { schema } from "prosemirror-schema-basic";
import { history as pmHistory, redo as pmRedo, undo as pmUndo } from "prosemirror-history";
import { keymap as pmKeymap } from "prosemirror-keymap";
import { safeTypeQuill } from "../src/quill";
import { safeTypeLexical } from "../src/lexical";
import { safeTypeCodeMirror } from "../src/codemirror";
import { safeTypeMonaco } from "../src/monaco";
import { safeTypeProseMirror } from "../src/prosemirror";

const $ = (id: string) => document.getElementById(id)!;
const texts: Record<string, () => string> = {};

// Quill 2
const quill = new Quill($("quill"), { modules: { toolbar: false } });
quill.root.setAttribute("aria-label", "quill");
safeTypeQuill(quill as never);
texts.quill = () => quill.getText().replace(/\n$/, "");

// Lexical
const lexical = createEditor({ namespace: "e2e", onError: (e) => console.error(e) });
lexical.setRootElement($("lexical"));
registerRichText(lexical);
registerHistory(lexical, createEmptyHistoryState(), 300);
safeTypeLexical(lexical);
texts.lexical = () => lexical.getEditorState().read(() => $getRoot().getTextContent());
(window as unknown as { lexicalBoldHtml: () => string }).lexicalBoldHtml = () => $("lexical").innerHTML;

// CodeMirror 6
const cm = safeTypeCodeMirror();
const cmView = new CMView({
  parent: $("codemirror"),
  state: CMState.create({ extensions: [cmHistory(), cmKeymap.of([...defaultKeymap, ...historyKeymap]), cm.extension] }),
});
cmView.contentDOM.setAttribute("aria-label", "codemirror");
texts.codemirror = () => cmView.state.doc.toString();

// Monaco (no workers needed for plaintext)
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new Worker(URL.createObjectURL(new Blob(["self.onmessage=()=>{}"], { type: "text/javascript" }))),
};
const monacoEditor = monaco.editor.create($("monaco"), {
  value: "",
  language: "plaintext",
  minimap: { enabled: false },
  automaticLayout: false,
  quickSuggestions: false,
  wordBasedSuggestions: "off",
});
safeTypeMonaco(monacoEditor as never);
texts.monaco = () => monacoEditor.getModel()!.getValue();

// ProseMirror
const pm = safeTypeProseMirror();
const pmView = new PMView($("prosemirror"), {
  state: PMState.create({ schema, plugins: [pmHistory(), pmKeymap({ "Mod-z": pmUndo, "Mod-y": pmRedo, "Mod-Shift-z": pmRedo }), pm.plugin] }),
});
pmView.dom.setAttribute("aria-label", "prosemirror");
texts.prosemirror = () => pmView.state.doc.textContent;

(window as unknown as { textOf: (name: string) => string }).textOf = (name) => texts[name]!();
