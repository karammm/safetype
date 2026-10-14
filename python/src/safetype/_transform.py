"""Masking, case matching and offset-mapped edits (mirrors transformer.ts)."""

from __future__ import annotations

import unicodedata

from ._normalize import LEET, normalize_char
from .types import MaskStyle, OffsetMapping, TextEdit

_WORD_EXTRA = frozenset("@$!|€")
_VOWELS = frozenset("aeiou")


def _is_word_char(ch: str) -> bool:
    if ch in _WORD_EXTRA:
        return True
    category = unicodedata.category(ch)
    return category.startswith("L") or category.startswith("N")


def mask_text(text: str, style: MaskStyle = "vowels", mask_char: str = "*") -> str:
    if callable(style):
        return style(text)
    chars = list(text)
    positions = [i for i, c in enumerate(chars) if _is_word_char(c)]
    if not positions:
        return text
    out = chars[:]
    first, last = positions[0], positions[-1]
    if style == "full":
        for i in positions:
            out[i] = mask_char
        return "".join(out)
    if style == "vowels":
        masked = 0
        for i in positions:
            if i == first:
                continue
            n = normalize_char(chars[i])
            if LEET.get(n, n) in _VOWELS:
                out[i] = mask_char
                masked += 1
        if masked:
            return "".join(out)
    for i in positions:
        if i == first or (i == last and len(positions) > 2):
            continue
        out[i] = mask_char
    return "".join(out)


def match_case(source: str, replacement: str) -> str:
    letters = "".join(c for c in source if unicodedata.category(c).startswith("L"))
    if len(letters) > 1 and letters == letters.upper() and letters != letters.lower():
        return replacement.upper()
    if letters and letters[0] != letters[0].lower():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def apply_edits(text: str, edits: list[TextEdit]) -> tuple[str, OffsetMapping]:
    ordered = sorted(edits, key=lambda e: e.start)
    for a, b in zip(ordered, ordered[1:]):
        if b.start < a.end:
            raise ValueError("Edits must not overlap")
    parts: list[str] = []
    cursor = 0
    for edit in ordered:
        parts.append(text[cursor : edit.start])
        parts.append(edit.replacement)
        cursor = edit.end
    parts.append(text[cursor:])
    out = "".join(parts)
    return out, OffsetMapping(ordered, len(text), len(out))
