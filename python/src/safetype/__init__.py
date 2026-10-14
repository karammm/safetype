"""SafeType: rule-based content moderation for Python servers.

The same engine and English dictionary as the SafeType.js JavaScript packages, so the server can
re-check exactly what the browser checked.

    >>> from safetype import create_moderation_engine
    >>> engine = create_moderation_engine(mode="mask")
    >>> engine.moderate("What the fuck are you doing?").text
    'What the f*ck are you doing?'
"""

from __future__ import annotations

from typing import Optional

from ._pattern import PatternError
from ._transform import mask_text, match_case
from .engine import ModerationEngine, create_moderation_engine, load_pack
from .types import (
    ModerationAction,
    ModerationCategory,
    ModerationMatch,
    ModerationResult,
    OffsetMapping,
    RuleDict,
    TextEdit,
    ValidationResult,
)

__version__ = "1.5.0"

_default: Optional[ModerationEngine] = None


def _engine() -> ModerationEngine:
    global _default
    if _default is None:
        _default = create_moderation_engine()
    return _default


def moderate(text: str) -> ModerationResult:
    """Moderates with a shared default engine (``mode="mask"``, English)."""
    return _engine().moderate(text)


def mask(text: str) -> str:
    """Masks with a shared default engine."""
    return _engine().mask(text)


__all__ = [
    "ModerationAction",
    "ModerationCategory",
    "ModerationEngine",
    "ModerationMatch",
    "ModerationResult",
    "OffsetMapping",
    "PatternError",
    "RuleDict",
    "TextEdit",
    "ValidationResult",
    "__version__",
    "create_moderation_engine",
    "load_pack",
    "mask",
    "mask_text",
    "match_case",
    "moderate",
]
