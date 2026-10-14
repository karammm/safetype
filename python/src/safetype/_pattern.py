"""Rule pattern parsing and repeated-letter tolerant matching (mirrors pattern.ts)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from ._normalize import normalize_term

Run = tuple[str, int]


class PatternError(ValueError):
    """Raised for invalid rule patterns."""


@dataclass(frozen=True)
class Alternative:
    value: str
    prefix: bool
    runs: tuple[Run, ...]
    key: str


@dataclass(frozen=True)
class Element:
    alternatives: tuple[Alternative, ...]
    optional: bool


def to_runs(value: str) -> tuple[Run, ...]:
    runs: list[list] = []
    for c in value:
        if runs and runs[-1][0] == c:
            runs[-1][1] += 1
        else:
            runs.append([c, 1])
    return tuple((c, n) for c, n in runs)


def runs_key(runs: tuple[Run, ...]) -> str:
    return "".join(c for c, _ in runs)


def runs_match(token: tuple[Run, ...], alt: Alternative) -> bool:
    """Every run in the token must be at least as long as the term's: "fuuuck" matches "fuck", "as" not "ass"."""
    term = alt.runs
    if (len(token) < len(term)) if alt.prefix else (len(token) != len(term)):
        return False
    for (tc, tn), (pc, pn) in zip(token, term):
        if tc != pc or tn < pn:
            return False
    return True


def _parse_alternative(raw: str, pattern: str) -> Alternative:
    prefix = raw.endswith("*")
    value = normalize_term(raw[:-1] if prefix else raw)
    if not value or re.search(r"\s", value):
        raise PatternError(f'Invalid token "{raw}" in pattern "{pattern}"')
    runs = to_runs(value)
    return Alternative(value, prefix, runs, runs_key(runs))


def parse_pattern(pattern: str) -> tuple[Element, ...]:
    parts = pattern.split()
    if not parts:
        raise PatternError("Pattern must not be empty")
    elements = []
    for index, part in enumerate(parts):
        body = part
        optional = body.endswith("?")
        if optional:
            body = body[:-1]
        if optional and index == 0:
            raise PatternError(f'First token cannot be optional in "{pattern}"')
        if body.startswith("("):
            if not body.endswith(")"):
                raise PatternError(f'Unclosed group "{part}" in "{pattern}"')
            body = body[1:-1]
        elements.append(Element(tuple(_parse_alternative(a, pattern) for a in body.split("|")), optional))
    return tuple(elements)
