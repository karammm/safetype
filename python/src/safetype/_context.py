"""Synchronous context heuristics (mirrors classifier.ts). They only lower confidence."""

from __future__ import annotations

from ._matcher import RawMatch
from ._tokenize import Token

CONTEXT_FACTOR = {"direct": 1.0, "quoted": 0.5, "mention": 0.4}

_MENTION_WORDS = frozenset(
    "word words term slur phrase say said saying says spell spelled called calling means meaning define definition using use".split()
)

_PAIRS = (('"', '"'), ("“", "”"), ("‘", "’"), ("«", "»"), ("「", "」"))


def find_quoted_ranges(text: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for open_, close in _PAIRS:
        start_from = 0
        while start_from < len(text):
            s = text.find(open_, start_from)
            if s == -1:
                break
            e = text.find(close, s + 1)
            if e == -1:
                break
            newline = text.find("\n", s)
            if newline != -1 and newline < e:
                start_from = newline + 1
                continue
            ranges.append((s + 1, e))
            start_from = e + 1
    return ranges


def detect_context(match: RawMatch, tokens: list[Token], quoted: list[tuple[int, int]]) -> str:
    if match.token_index is not None:
        for k in (1, 2):
            i = match.token_index - k
            if i >= 0 and tokens[i].value in _MENTION_WORDS:
                return "mention"
    for s, e in quoted:
        if match.start >= s and match.end <= e:
            return "quoted"
    return "direct"
