"""Unicode-aware normalization with an offset map back to the original text (mirrors normalizer.ts)."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from functools import lru_cache

_ZERO_WIDTH = frozenset("​‌‍⁠﻿­᠎")

# Cyrillic and Greek letters that look like Latin letters (lowercase forms).
_CONFUSABLES = {
    "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
    "у": "y", "х": "x", "ѕ": "s", "і": "i", "ї": "i", "ј": "j", "һ": "h", "ԁ": "d", "ԛ": "q", "ԝ": "w", "ү": "y",
    "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u",
    "χ": "x", "ω": "w",
}

# Symbol/digit substitutions, applied only inside tokens that already contain a letter.
LEET = {"@": "a", "4": "a", "$": "s", "5": "s", "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "€": "e", "7": "t"}


# Spelling variants folded to one form: German sharp s, Devanagari candrabindu to anusvara.
_FOLDS = {"\u00df": "ss", "\u0901": "\u0902"}


def is_mark(ch: str) -> bool:
    return unicodedata.category(ch).startswith("M")


def _is_indic_mark(ch: str) -> bool:
    # Indic vowel signs, viramas and nuktas are part of the spelling, so they are kept.
    return 0x0900 <= ord(ch) <= 0x0DFF


@lru_cache(maxsize=10_000)
def normalize_char(ch: str) -> str:
    if ch in _ZERO_WIDTH:
        return ""
    out: list[str] = []
    for c in unicodedata.normalize("NFKD", ch.lower()):
        if is_mark(c) and not _is_indic_mark(c):
            continue
        lower = c.lower()
        out.append(_FOLDS.get(lower) or _CONFUSABLES.get(lower, lower))
    return "".join(out)


@dataclass(frozen=True)
class NormalizedText:
    text: str
    starts: list[int]
    """Original start offset for each character of ``text``."""
    ends: list[int]
    """Original end offset (exclusive) for each character of ``text``."""


def normalize(value: str) -> NormalizedText:
    out: list[str] = []
    starts: list[int] = []
    ends: list[int] = []
    for i, ch in enumerate(value):
        n = normalize_char(ch)
        for c in n:
            out.append(c)
            starts.append(i)
            ends.append(i + 1)
    return NormalizedText("".join(out), starts, ends)


def is_letter(ch: str) -> bool:
    return unicodedata.category(ch).startswith("L")


def apply_leet(value: str) -> str:
    if not any(is_letter(c) for c in value):
        return value
    return "".join(LEET.get(c, c) for c in value)


def normalize_term(value: str) -> str:
    return apply_leet(normalize(value).text)
