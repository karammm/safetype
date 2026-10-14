import { applyEdits, type TextEdit } from "@safetype/core";

export interface TextSelection {
  start: number;
  end: number;
}

/** Read/write access to the plain text of an editable element. */
export interface Surface {
  getText(): string;
  /** Selection in text offsets, or null when the selection is not inside the element. */
  getSelection(): TextSelection | null;
  /** Applies edits computed against `original`, preserving selection and undo history where possible. */
  apply(original: string, edits: readonly TextEdit[]): void;
}

function canExecCommand(doc: Document): boolean {
  return typeof doc.execCommand === "function";
}

function descending(edits: readonly TextEdit[]): TextEdit[] {
  return [...edits].sort((a, b) => b.start - a.start);
}

/** Sets a value so that frameworks tracking the value property (React, Vue) observe the change. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
  if (descriptor?.set) descriptor.set.call(el, value);
  else el.value = value;
}

export class NativeSurface implements Surface {
  constructor(private readonly el: HTMLInputElement | HTMLTextAreaElement) {}

  getText(): string {
    return this.el.value;
  }

  getSelection(): TextSelection | null {
    const { el } = this;
    if (el.ownerDocument.activeElement !== el || el.selectionStart === null || el.selectionEnd === null) return null;
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  apply(original: string, edits: readonly TextEdit[]): void {
    const { el } = this;
    const doc = el.ownerDocument;
    const { text: expected, mapping } = applyEdits(original, edits);
    const selection = this.getSelection();
    const direction = el.selectionDirection ?? undefined;
    const { scrollTop, scrollLeft } = el;

    // execCommand keeps the browser's undo stack intact and fires real input events.
    let ok = false;
    if (selection && canExecCommand(doc)) {
      ok = true;
      try {
        for (const edit of descending(edits)) {
          el.setSelectionRange(edit.start, edit.end);
          if (!doc.execCommand("insertText", false, edit.replacement)) {
            ok = false;
            break;
          }
        }
      } catch {
        ok = false;
      }
    }
    if (!ok || el.value !== expected) {
      setNativeValue(el, expected);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (selection) {
      try {
        el.setSelectionRange(mapping.toTransformed(selection.start), mapping.toTransformed(selection.end), direction);
      } catch {
        // Some input types reject selection APIs; caret placement is best-effort.
      }
    }
    el.scrollTop = scrollTop;
    el.scrollLeft = scrollLeft;
  }
}

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET",
  "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
  "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TD", "TH", "TR", "UL",
]);

const SHOW_ELEMENT = 0x1;
const SHOW_TEXT = 0x4;

interface Segment {
  node: Text;
  start: number;
  end: number;
}

interface Snapshot {
  text: string;
  segments: Segment[];
}

/**
 * contenteditable support. Text is read across text nodes; block boundaries and <br> become "\n" so
 * words in different paragraphs never join. Edits touch only the affected characters in their text
 * nodes, so bold/italic/link markup is preserved.
 */
export class ContentEditableSurface implements Surface {
  constructor(private readonly root: HTMLElement) {}

  private blockOf(node: Node): Node {
    for (let n = node.parentNode; n && n !== this.root; n = n.parentNode) {
      if (n.nodeType === 1 && BLOCK_TAGS.has((n as Element).tagName)) return n;
    }
    return this.root;
  }

  private snapshot(): Snapshot {
    const doc = this.root.ownerDocument;
    const walker = doc.createTreeWalker(this.root, SHOW_ELEMENT | SHOW_TEXT);
    let text = "";
    const segments: Segment[] = [];
    let lastBlock: Node | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 1) {
        if ((node as Element).tagName === "BR") text += "\n";
        continue;
      }
      const textNode = node as Text;
      const block = this.blockOf(textNode);
      if (lastBlock && block !== lastBlock && !text.endsWith("\n")) text += "\n";
      lastBlock = block;
      segments.push({ node: textNode, start: text.length, end: text.length + textNode.data.length });
      text += textNode.data;
    }
    return { text, segments };
  }

  private pointFor(offset: number, segments: readonly Segment[]): { node: Node; offset: number } {
    for (const seg of segments) {
      if (offset < seg.start) return { node: seg.node, offset: 0 };
      if (offset <= seg.end) return { node: seg.node, offset: offset - seg.start };
    }
    const last = segments[segments.length - 1];
    return last ? { node: last.node, offset: last.node.data.length } : { node: this.root, offset: 0 };
  }

  private offsetFor(node: Node, offset: number, segments: readonly Segment[]): number {
    const range = this.root.ownerDocument.createRange();
    range.setStart(this.root, 0);
    range.setEnd(node, offset);
    let result = 0;
    for (const seg of segments) {
      if (seg.node === node) return seg.start + offset;
      if (range.comparePoint(seg.node, seg.node.data.length) === 0) result = seg.end;
      else break;
    }
    return result;
  }

  getText(): string {
    return this.snapshot().text;
  }

  getSelection(): TextSelection | null {
    const selection = this.root.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!this.root.contains(range.startContainer) || !this.root.contains(range.endContainer)) return null;
    const { segments } = this.snapshot();
    return {
      start: this.offsetFor(range.startContainer, range.startOffset, segments),
      end: this.offsetFor(range.endContainer, range.endOffset, segments),
    };
  }

  private replaceDirect(edit: TextEdit, segments: readonly Segment[]): void {
    const sameLength = edit.replacement.length === edit.end - edit.start;
    let first = true;
    for (const seg of segments) {
      const s = Math.max(edit.start, seg.start);
      const e = Math.min(edit.end, seg.end);
      if (s >= e) continue;
      if (sameLength) {
        const piece = edit.replacement.slice(s - edit.start, e - edit.start);
        if (seg.node.data.slice(s - seg.start, e - seg.start) !== piece) seg.node.replaceData(s - seg.start, e - s, piece);
      } else if (first) {
        seg.node.replaceData(s - seg.start, e - s, edit.replacement);
      } else {
        seg.node.deleteData(s - seg.start, e - s);
      }
      first = false;
    }
  }

  apply(original: string, edits: readonly TextEdit[]): void {
    const doc = this.root.ownerDocument;
    const { mapping } = applyEdits(original, edits);
    const selection = this.getSelection();

    for (const edit of descending(edits)) {
      const { segments } = this.snapshot();
      const a = this.pointFor(edit.start, segments);
      const b = this.pointFor(edit.end, segments);
      if (selection && a.node === b.node && a.node.nodeType === 3 && canExecCommand(doc)) {
        const range = doc.createRange();
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, b.offset);
        const sel = doc.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        try {
          if (doc.execCommand("insertText", false, edit.replacement)) continue;
        } catch {
          // fall through to direct replacement
        }
      }
      this.replaceDirect(edit, segments);
    }

    if (selection) {
      const { segments } = this.snapshot();
      const start = this.pointFor(mapping.toTransformed(selection.start), segments);
      const end = this.pointFor(mapping.toTransformed(selection.end), segments);
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const sel = doc.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
}
