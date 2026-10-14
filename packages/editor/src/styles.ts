export const EDITOR_STYLES = `
.safetype-editor{--st-bg:#fff;--st-fg:#141a26;--st-muted:#5d6880;--st-line:#d6dbe6;--st-toolbar:#f6f7fb;--st-accent:#0f7f70;--st-focus:rgba(15,127,112,.25);--st-warn:#8a5300;--st-warn-bg:rgba(245,176,65,.18);--st-block:#b42318;--st-block-bg:rgba(248,113,113,.16);--st-review:#6d4bd8;--st-suggest:#0f7f70;
  color:var(--st-fg);background:var(--st-bg);border:1px solid var(--st-line);border-radius:10px;font:inherit;overflow:hidden}
.safetype-editor[data-theme="dark"]{--st-bg:#0e1626;--st-fg:#e6edf7;--st-muted:#8a9bb8;--st-line:#22304d;--st-toolbar:#121b2e;--st-accent:#2dd4bf;--st-focus:rgba(45,212,191,.25);--st-warn:#f5b041;--st-block:#f87171;--st-review:#a78bfa;--st-suggest:#2dd4bf}
@media (prefers-color-scheme: dark){.safetype-editor[data-theme="auto"]{--st-bg:#0e1626;--st-fg:#e6edf7;--st-muted:#8a9bb8;--st-line:#22304d;--st-toolbar:#121b2e;--st-accent:#2dd4bf;--st-focus:rgba(45,212,191,.25);--st-warn:#f5b041;--st-block:#f87171;--st-review:#a78bfa;--st-suggest:#2dd4bf}}
.safetype-editor:focus-within{border-color:var(--st-accent);box-shadow:0 0 0 3px var(--st-focus)}
.safetype-editor-toolbar{display:flex;flex-wrap:wrap;gap:2px;padding:6px;background:var(--st-toolbar);border-bottom:1px solid var(--st-line)}
.safetype-editor-toolbar button{font:inherit;font-size:14px;min-width:32px;height:32px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--st-fg);cursor:pointer}
.safetype-editor-toolbar button:hover{border-color:var(--st-line)}
.safetype-editor-toolbar button:focus-visible{outline:2px solid var(--st-accent);outline-offset:1px}
.safetype-editor-toolbar button[aria-pressed="true"]{background:var(--st-focus);border-color:var(--st-accent)}
.safetype-editor-toolbar button:disabled{opacity:.4;cursor:default}
.safetype-editor-toolbar .sep{width:1px;margin:4px;background:var(--st-line)}
.safetype-editor-content .ProseMirror{min-height:120px;padding:12px 14px;outline:none;line-height:1.5}
.safetype-editor-content .ProseMirror>*:first-child{margin-top:0}
.safetype-editor-content .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:var(--st-muted);float:left;height:0;pointer-events:none}
.safetype-editor-content a{color:var(--st-accent)}
.safetype-highlight-warn{background:var(--st-warn-bg);text-decoration:underline wavy var(--st-warn);text-underline-offset:3px}
.safetype-highlight-block{background:var(--st-block-bg);text-decoration:underline wavy var(--st-block);text-underline-offset:3px}
.safetype-highlight-suggest{text-decoration:underline dashed var(--st-suggest);text-underline-offset:3px}
.safetype-highlight-review{text-decoration:underline dotted var(--st-review);text-underline-offset:3px}
.safetype-editor-footer{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:6px 12px;padding:6px 12px 8px;border-top:1px solid var(--st-line);font-size:13px;color:var(--st-muted)}
.safetype-editor-footer:empty{display:none}
.safetype-editor-status[data-level="warn"]{color:var(--st-warn)}
.safetype-editor-status[data-level="block"]{color:var(--st-block)}
.safetype-editor-suggestions{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.safetype-editor-suggestions button{font:inherit;font-size:13px;padding:2px 10px;border-radius:999px;border:1px solid var(--st-suggest);background:transparent;color:var(--st-suggest);cursor:pointer}
.safetype-editor-count{margin-left:auto;font-variant-numeric:tabular-nums}
.safetype-editor-count[data-over="true"]{color:var(--st-block)}
`;
