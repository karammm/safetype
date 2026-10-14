"""Replays cases recorded from the JavaScript engine (scripts/generate-parity.mjs); results must match exactly."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from safetype import create_moderation_engine

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "parity.json").read_text(encoding="utf-8"))


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _engine(config: dict):
    return create_moderation_engine(**{_snake(k): v for k, v in config.items()})


ENGINES = {name: _engine(config) for name, config in FIXTURE["configs"].items()}


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: f'{c["config"]}:{c["input"][:30]!r}')
def test_matches_javascript_engine(case: dict) -> None:
    engine = ENGINES[case["config"]]
    expected = case["expected"]
    result = engine.moderate(case["input"])
    assert result.text == expected["text"]
    assert result.suggested_text == expected["suggestedText"]
    assert result.action == expected["action"]
    assert result.allowed == expected["allowed"]
    assert result.requires_review == expected["requiresReview"]
    assert engine.mask(case["input"]) == expected["masked"]
    actual = [
        {
            "start": m.start,
            "end": m.end,
            "text": m.text,
            "ruleId": m.rule_id,
            "category": m.category,
            "severity": m.severity,
            "action": m.action,
            "confidence": m.confidence,
            "context": m.context,
            "applied": m.applied,
            "requiresReview": m.requires_review,
            "suggestedReplacement": m.suggested_replacement,
            "label": m.label,
        }
        for m in result.matches
    ]
    assert actual == expected["matches"]
