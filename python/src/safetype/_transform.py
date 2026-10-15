"""Masking, case matching and offset-mapped edits (mirrors transformer.ts)."""

from __future__ import annotations

import unicodedata

from ._normalize import LEET, is_mark, normalize_char
from .types import MaskStyle, OffsetMapping, TextEdit

_WORD_EXTRA = frozenset("@$!|€")
_VOWELS = frozenset("aeiou")


def _is_word_char(ch: str) -> bool:
    if ch in _WORD_EXTRA:
        return True
    category = unicodedata.category(ch)
    return category.startswith("L") or category.startswith("N")


def _clusters(text: str) -> list[str]:
    """A base character plus its combining marks, so a mask never leaves a stray vowel sign."""
    out: list[str] = []
    for c in text:
        if out and is_mark(c):
            out[-1] += c
        else:
            out.append(c)
    return out


def mask_text(text: str, style: MaskStyle = "vowels", mask_char: str = "*") -> str:
    if callable(style):
        return style(text)
    units = _clusters(text)
    positions = [i for i, u in enumerate(units) if _is_word_char(u[0])]
    if not positions:
        return text
    out = units[:]
    first, last = positions[0], positions[-1]
    if style == "full":
        for i in positions:
            out[i] = mask_char
        return "".join(out)
    if style == "vowels":
        # Something before the last character must be masked: a lone trailing mask reads as emphasis
        # ("word*") on the next pass, so the word would be matched and masked again.
        interior = 0
        for i in positions:
            if i == first:
                continue
            n = normalize_char(units[i][0])
            if LEET.get(n, n) in _VOWELS:
                out[i] = mask_char
                if i != last:
                    interior += 1
        if interior:
            return "".join(out)
        out = units[:]
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
