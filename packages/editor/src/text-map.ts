import type { Node as PMNode } from "@tiptap/pm/model";

interface Segment {
  /** Document position of the text node's first character. */
  pos: number;
  /** Offsets of the node's text in the plain-text string. */
  start: number;
  end: number;
}

/**
 * Plain text of a ProseMirror document plus a two-way map between text offsets and document positions.
 * Text blocks and hard breaks become "\n", so words in different paragraphs never join.
 */
export class TextMap {
  readonly text: string;
  private readonly segments: Segment[];

  constructor(doc: PMNode) {
    let text = "";
    const segments: Segment[] = [];
    doc.descendants((node, pos) => {
      if (node.isTextblock) {
        if (text.length > 0 && !text.endsWith("\n")) text += "\n";
        return true;
      }
      if (node.isText) {
        const value = node.text ?? "";
        segments.push({ pos, start: text.length, end: text.length + value.length });
        text += value;
        return false;
      }
      if (node.type.name === "hardBreak") text += "\n";
      return true;
    });
    this.text = text;
    this.segments = segments;
  }

  /** Position of the character at `offset` (which must be a text character, not a separator). */
  charPos(offset: number): number | null {
    for (const seg of this.segments) if (offset >= seg.start && offset < seg.end) return seg.pos + (offset - seg.start);
    return null;
  }

  /** Position for an offset at a boundary (start or end of a range). */
  boundaryPos(offset: number, side: "start" | "end"): number | null {
    if (side === "start") {
      for (const seg of this.segments) if (offset >= seg.start && offset < seg.end) return seg.pos + (offset - seg.start);
    }
    for (const seg of this.segments) if (offset > seg.start && offset <= seg.end) return seg.pos + (offset - seg.start);
    for (const seg of this.segments) if (offset === seg.start) return seg.pos;
    return null;
  }

  /** Text offset for a document position (e.g. the cursor). */
  offsetAt(pos: number): number | null {
    for (const seg of this.segments) {
      const length = seg.end - seg.start;
      if (pos >= seg.pos && pos <= seg.pos + length) return seg.start + (pos - seg.pos);
    }
    return null;
  }
}
