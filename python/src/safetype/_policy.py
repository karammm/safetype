"""Per-category policies (mirrors policy-engine.ts)."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Iterable, Mapping

from .types import ACTION_SEVERITY, ALL_CATEGORIES, SEVERITY_RANK


@dataclass(frozen=True)
class ResolvedPolicy:
    enabled: bool
    action: str
    min_confidence: float
    min_severity: str


def assert_action(action: Any) -> None:
    if action not in ACTION_SEVERITY:
        raise TypeError(f'Unknown moderation action "{action}"')


def default_policies(mode: str, categories: Iterable[str]) -> dict[str, ResolvedPolicy]:
    enabled = set(categories)
    return {
        "profanity": ResolvedPolicy("profanity" in enabled, mode, 0, "medium"),
        "custom": ResolvedPolicy("custom" in enabled, mode, 0, "low"),
        "hate": ResolvedPolicy("hate" in enabled, mode, 0.6, "low"),
        "harassment": ResolvedPolicy("harassment" in enabled, "warn" if mode == "mask" else mode, 0.6, "low"),
        "sexual": ResolvedPolicy("sexual" in enabled, "warn" if mode == "mask" else mode, 0.6, "low"),
    }


def _get(override: Mapping[str, Any], *names: str) -> Any:
    for name in names:
        if name in override and override[name] is not None:
            return override[name]
    return None


def apply_overrides(base: dict[str, ResolvedPolicy], overrides: Mapping[str, Mapping[str, Any]] | None) -> dict[str, ResolvedPolicy]:
    result = dict(base)
    if not overrides:
        return result
    for category in ALL_CATEGORIES:
        override = overrides.get(category)
        if not override:
            continue
        action = _get(override, "action")
        min_confidence = _get(override, "min_confidence", "minConfidence")
        min_severity = _get(override, "min_severity", "minSeverity")
        if action is not None:
            assert_action(action)
        if min_confidence is not None and not (0 <= min_confidence <= 1):
            raise ValueError(f'min_confidence for "{category}" must be within [0, 1]')
        if min_severity is not None and min_severity not in SEVERITY_RANK:
            raise TypeError(f'Unknown severity "{min_severity}"')
        current = result[category]
        result[category] = replace(
            current,
            action=action if action is not None else current.action,
            min_confidence=min_confidence if min_confidence is not None else current.min_confidence,
            min_severity=min_severity if min_severity is not None else current.min_severity,
        )
    return result


def decide(policy: ResolvedPolicy, severity: str, confidence: float) -> tuple[bool, str, bool]:
    """Returns (keep, action, requires_review)."""
    if not policy.enabled or SEVERITY_RANK[severity] < SEVERITY_RANK[policy.min_severity]:
        return False, "allow", False
    if confidence < policy.min_confidence:
        return True, "allow", True
    return True, policy.action, False


def most_restrictive(actions: Iterable[str]) -> str:
    result = "allow"
    for action in actions:
        if ACTION_SEVERITY[action] > ACTION_SEVERITY[result]:
            result = action
    return result
