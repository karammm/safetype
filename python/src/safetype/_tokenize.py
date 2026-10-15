"""Tokenization over normalized text (mirrors tokenizer.ts)."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from ._normalize import NormalizedText, apply_leet

_EXTRA_TOKEN_CHARS = frozenset("@$!|*€")
_EDGE_TRIM = frozenset("*!|")
_SPACED_SEPARATORS = frozenset(" .-_")


@dataclass
class Token:
    start: int
    end: int
    n_start: int
    n_end: int
    value: str
    masked: bool
    first_index: int


def _is_token_char(ch: str, mask_char: str) -> bool:
    if ch in _EXTRA_TOKEN_CHARS or ch == mask_char:
        return True
    # Marks: Indic vowel signs and viramas are part of a word (Latin diacritics are already stripped).
    category = unicodedata.category(ch)
    return category[0] in "LMN"


def tokenize(normalized: NormalizedText, mask_char: str = "*") -> list[Token]:
    text = normalized.text
    tokens: list[Token] = []
    i = 0
    length = len(text)
    while i < length:
        if not _is_token_char(text[i], mask_char):
            i += 1
            continue
        j = i
        while j < length and _is_token_char(text[j], mask_char):
            j += 1
        n_start, n_end = i, j
        while n_start < n_end and text[n_start] in _EDGE_TRIM:
            n_start += 1
        while n_end > n_start and text[n_end - 1] in _EDGE_TRIM:
            n_end -= 1
        if n_start < n_end:
            raw = text[n_start:n_end]
            tokens.append(
                Token(
                    start=normalized.starts[n_start],
                    end=normalized.ends[n_end - 1],
                    n_start=n_start,
                    n_end=n_end,
                    value=apply_leet(raw),
                    masked=mask_char in raw,
                    first_index=len(tokens),
                )
            )
        i = j
    return tokens


def merge_spaced_letters(tokens: list[Token], normalized_text: str) -> list[Token]:
    """Merges runs of 3+ single-character tokens ("f u c k") into virtual tokens."""
    merged: list[Token] = []
    i = 0
    while i < len(tokens):
        j = i
        while (
            j + 1 < len(tokens)
            and len(tokens[j].value) == 1
            and len(tokens[j + 1].value) == 1
            and tokens[j + 1].n_start - tokens[j].n_end == 1
            and normalized_text[tokens[j].n_end] in _SPACED_SEPARATORS
        ):
            j += 1
        if j - i + 1 >= 3:
            run = tokens[i : j + 1]
            merged.append(
                Token(
                    start=run[0].start,
                    end=run[-1].end,
                    n_start=run[0].n_start,
                    n_end=run[-1].n_end,
                    value="".join(t.value for t in run),
                    masked=any(t.masked for t in run),
                    first_index=i,
                )
            )
            i = j + 1
        else:
            i += 1
    return merged
