"""Public data types. Field names are snake_case versions of the JavaScript API."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal, Optional, TypedDict, Union

ModerationAction = Literal["allow", "mask", "suggest", "warn", "block"]
ModerationCategory = Literal["profanity", "hate", "harassment", "custom"]
Severity = Literal["low", "medium", "high", "critical"]
MatchContext = Literal["direct", "quoted", "mention"]
MaskStyle = Union[Literal["vowels", "partial", "full"], Callable[[str], str]]

ACTION_SEVERITY = {"allow": 0, "mask": 1, "suggest": 2, "warn": 3, "block": 4}
SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
ALL_CATEGORIES: tuple[ModerationCategory, ...] = ("profanity", "hate", "harassment", "custom")


class RuleDict(TypedDict, total=False):
    id: str
    pattern: str
    category: ModerationCategory
    severity: Severity
    confidence: float
    priority: int
    replacement: str
    label: str


@dataclass(frozen=True)
class TextEdit:
    start: int
    end: int
    replacement: str


@dataclass
class ModerationMatch:
    start: int
    """Start offset in the original text (code points, inclusive)."""
    end: int
    """End offset in the original text (exclusive)."""
    text: str
    category: ModerationCategory
    rule_id: str
    severity: Severity
    confidence: float
    priority: int
    context: MatchContext
    action: ModerationAction
    requires_review: bool
    applied: bool
    suggested_replacement: Optional[str] = None
    label: Optional[str] = None
    source: Optional[str] = None


class OffsetMapping:
    """Maps offsets between the original and the transformed text."""

    def __init__(self, edits: list[TextEdit], original_length: int, transformed_length: int) -> None:
        self.edits: tuple[TextEdit, ...] = tuple(edits)
        self._original_length = original_length
        self._transformed_length = transformed_length

    def to_transformed(self, offset: int) -> int:
        o = min(max(0, int(offset)), self._original_length)
        delta = 0
        for e in self.edits:
            if o <= e.start:
                return o + delta
            if o < e.end:
                return e.start + delta + min(o - e.start, len(e.replacement))
            delta += len(e.replacement) - (e.end - e.start)
        return o + delta

    def to_original(self, offset: int) -> int:
        t = min(max(0, int(offset)), self._transformed_length)
        delta = 0
        for e in self.edits:
            new_start = e.start + delta
            new_end = new_start + len(e.replacement)
            if t <= new_start:
                return t - delta
            if t < new_end:
                return e.start + min(t - new_start, e.end - e.start)
            delta += len(e.replacement) - (e.end - e.start)
        return t - delta


@dataclass
class ModerationResult:
    original_text: str
    text: str
    """Text after mask transformations."""
    suggested_text: str
    matches: list[ModerationMatch]
    allowed: bool
    """False only when the overall action is ``block``."""
    action: ModerationAction
    requires_review: bool
    mapping: OffsetMapping = field(repr=False)


@dataclass
class ValidationResult:
    valid: bool
    result: ModerationResult
    violations: list[ModerationMatch]
