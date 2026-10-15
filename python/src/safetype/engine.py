"""The moderation engine (mirrors create-engine.ts)."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from functools import lru_cache
from importlib import resources
from typing import Any, Iterable, Mapping, Optional, Sequence

from ._context import CONTEXT_FACTOR, detect_context, find_quoted_ranges
from ._matcher import CompiledRule, RawMatch, RuleIndex, compile_rule, find_matches
from ._normalize import normalize, normalize_term
from ._policy import apply_overrides, assert_action, decide, default_policies, most_restrictive
from ._tokenize import merge_spaced_letters, tokenize
from ._transform import apply_edits, mask_text, match_case
from .types import (
    ALL_CATEGORIES,
    MaskStyle,
    ModerationMatch,
    ModerationResult,
    RuleDict,
    TextEdit,
    ValidationResult,
)

PolicyMap = Mapping[str, Mapping[str, Any]]


# Packs enabled by `language` when `languages` is not given. English includes Hinglish (romanized Hindi),
# which is common in English-language apps; Hindi includes both scripts. Other languages are single packs.
DEFAULT_LANGUAGES = {"en": ("en", "hi-latn"), "hi": ("hi", "hi-latn")}


@lru_cache(maxsize=None)
def load_pack(language: str) -> dict:
    """Loads a built-in dictionary pack (the same JSON the JavaScript packages are built from)."""
    key = language.lower()
    for name in (key, key.split("-")[0]):
        try:
            raw = resources.files("safetype").joinpath(f"data/{name}.json").read_text(encoding="utf-8")
            return json.loads(raw)
        except FileNotFoundError:
            continue
    raise ValueError(f'No built-in dictionary pack for language "{language}". Pass one via `packs`.')


def _has_pack(name: str) -> bool:
    return resources.files("safetype").joinpath(f"data/{name}.json").is_file()


def default_packs(language: str, languages: Optional[Sequence[str]] = None) -> list[dict]:
    if languages is not None:
        names: Sequence[str] = languages
    else:
        tag = language.lower()
        # An exact pack tag ("hi-Latn") wins over the defaults of its base language ("hi").
        if _has_pack(tag) and tag not in DEFAULT_LANGUAGES:
            names = (tag,)
        else:
            names = DEFAULT_LANGUAGES.get(tag.split("-")[0], (language,))
    return [load_pack(name) for name in names]


def _round(value: float) -> float:
    # Matches JavaScript's Math.round(n * 10000) / 10000 for non-negative values.
    return math.floor(value * 10_000 + 0.5) / 10_000


class ModerationEngine:
    """Rule-based moderation. Create one with :func:`create_moderation_engine` and reuse it."""

    def __init__(
        self,
        *,
        mode: str = "mask",
        language: str = "en",
        languages: Optional[Sequence[str]] = None,
        categories: Optional[Iterable[str]] = None,
        policy: Optional[PolicyMap] = None,
        packs: Optional[Sequence[Mapping[str, Any]]] = None,
        custom_words: Optional[Iterable[str]] = None,
        allow_list: Optional[Iterable[str]] = None,
        rules: Optional[Iterable[RuleDict]] = None,
        mask_char: str = "*",
        mask_style: MaskStyle = "vowels",
        detect_spaced_letters: bool = True,
    ) -> None:
        assert_action(mode)
        self._mode = mode
        self._categories = tuple(categories) if categories is not None else ALL_CATEGORIES
        for c in self._categories:
            if c not in ALL_CATEGORIES:
                raise TypeError(f'Unknown category "{c}"')
        if len(mask_char) != 1 or unicodedata.category(mask_char)[0] in "LN" or mask_char.isspace():
            raise TypeError("mask_char must be a single non-letter, non-digit, non-space character")
        self._mask_char = mask_char
        self._mask_style = mask_style
        self._detect_spaced = detect_spaced_letters
        self._rules: dict[str, tuple[dict, CompiledRule]] = {}
        self._allow_list: set[str] = set()
        self._index: Optional[RuleIndex] = None

        for pack in packs if packs is not None else default_packs(language, languages):
            boundary = pack.get("boundary", "word")
            for rule in pack.get("rules", []):
                self._put(rule, boundary)
            for word in pack.get("allowList", pack.get("allow_list", [])):
                self._allow_list.add(normalize_term(word))
        for word in custom_words or []:
            pattern = " ".join(re.sub(r"[()|?]", "", word).split())
            if pattern:
                rule_id = "custom." + re.sub(r"\s+", "-", normalize_term(pattern))
                self._put({"id": rule_id, "pattern": pattern, "category": "custom", "severity": "medium"})
        for rule in rules or []:
            self._put(dict(rule))
        for word in allow_list or []:
            self._allow_list.add(normalize_term(word))

        self._overrides: dict[str, dict[str, Any]] = {k: dict(v) for k, v in (policy or {}).items()}
        self._policies = apply_overrides(default_policies(self._mode, self._categories), self._overrides)

    # ---- rules ----
    def _put(self, rule: Mapping[str, Any], boundary: str = "word") -> None:
        compiled = compile_rule(dict(rule), boundary)  # type: ignore[arg-type]
        self._rules[compiled.id] = (dict(rule), compiled)
        self._index = None

    def add_rule(self, rule: RuleDict) -> None:
        self._put(dict(rule))

    def remove_rule(self, rule_id: str) -> bool:
        removed = self._rules.pop(rule_id, None) is not None
        if removed:
            self._index = None
        return removed

    def get_rules(self) -> list[dict]:
        return [dict(source) for source, _ in self._rules.values()]

    # ---- policy ----
    def set_policy(self, policy: PolicyMap) -> None:
        merged = {k: dict(v) for k, v in self._overrides.items()}
        for category in ALL_CATEGORIES:
            if category in policy and policy[category]:
                merged.setdefault(category, {}).update(policy[category])
        self._policies = apply_overrides(default_policies(self._mode, self._categories), merged)
        self._overrides = merged

    def set_mode(self, mode: str) -> None:
        assert_action(mode)
        self._mode = mode
        self._policies = apply_overrides(default_policies(self._mode, self._categories), self._overrides)

    # ---- pipeline ----
    def _get_index(self) -> RuleIndex:
        if self._index is None:
            self._index = RuleIndex.build(compiled for _, compiled in self._rules.values())
        return self._index

    def _analyze(self, text: str) -> list[RawMatch]:
        normalized = normalize(text)
        tokens = tokenize(normalized, self._mask_char)
        spaced = merge_spaced_letters(tokens, normalized.text) if self._detect_spaced else []
        raw = find_matches(self._get_index(), normalized, tokens, spaced, self._allow_list)
        if not raw:
            return []
        quoted = find_quoted_ranges(text)
        for m in raw:
            m.context = detect_context(m, tokens, quoted)
            m.confidence = _round(m.confidence * CONTEXT_FACTOR[m.context])
        return raw

    @staticmethod
    def _select(matches: list[ModerationMatch]) -> list[ModerationMatch]:
        ordered = sorted(matches, key=lambda m: (-m.priority, -(m.end - m.start), m.start, m.rule_id))
        accepted: list[ModerationMatch] = []
        for m in ordered:
            if all(m.end <= a.start or m.start >= a.end for a in accepted):
                accepted.append(m)
        return accepted

    def _finalize(self, text: str, scored: list[RawMatch], force_action: Optional[str] = None) -> ModerationResult:
        matches: list[ModerationMatch] = []
        for s in scored:
            rule = s.rule
            keep, action, review = decide(self._policies[rule.category], rule.severity, s.confidence)
            if not keep:
                continue
            if force_action and action != "allow":
                action = force_action
            if action == "mask" and len(rule.elements) > 1 and rule.category in ("hate", "harassment", "sexual"):
                action = "warn"
            matched = text[s.start : s.end]
            match = ModerationMatch(
                start=s.start, end=s.end, text=matched, category=rule.category, rule_id=rule.id,  # type: ignore[arg-type]
                severity=rule.severity, confidence=s.confidence, priority=rule.priority,  # type: ignore[arg-type]
                context=s.context, action=action, requires_review=review, applied=False,  # type: ignore[arg-type]
            )
            if rule.replacement is not None:
                match.suggested_replacement = match_case(matched, rule.replacement)
            elif action == "suggest":
                match.suggested_replacement = mask_text(matched, self._mask_style, self._mask_char)
            match.label = rule.label
            match.source = s.source
            matches.append(match)
        matches.sort(key=lambda m: (m.start, m.end, -m.priority))

        mask_edits = self._select([m for m in matches if m.action == "mask"])
        suggest_edits = self._select([m for m in matches if m.action in ("mask", "suggest")])

        def to_edit(m: ModerationMatch) -> TextEdit:
            if m.action == "suggest" and m.suggested_replacement is not None:
                return TextEdit(m.start, m.end, m.suggested_replacement)
            return TextEdit(m.start, m.end, mask_text(m.text, self._mask_style, self._mask_char))

        for m in mask_edits:
            m.applied = True
        for m in suggest_edits:
            if m.action == "suggest":
                m.applied = True
        masked, mapping = apply_edits(text, [to_edit(m) for m in mask_edits])
        suggested, _ = apply_edits(text, [to_edit(m) for m in suggest_edits])
        action = most_restrictive(m.action for m in matches)
        return ModerationResult(
            original_text=text,
            text=masked,
            suggested_text=suggested,
            matches=matches,
            allowed=action != "block",
            action=action,  # type: ignore[arg-type]
            requires_review=any(m.requires_review for m in matches),
            mapping=mapping,
        )

    # ---- public API ----
    def moderate(self, text: str) -> ModerationResult:
        """Rule-based moderation. Runs locally; nothing is sent anywhere."""
        return self._finalize(text, self._analyze(text))

    def mask(self, text: str) -> str:
        """The text with every actionable match masked, regardless of the configured action."""
        return self._finalize(text, self._analyze(text), "mask").text

    def validate(self, text: str) -> ValidationResult:
        """Server-side check: ``valid`` is False when the policy blocks the content."""
        result = self.moderate(text)
        return ValidationResult(result.allowed, result, [m for m in result.matches if m.action != "allow"])


def create_moderation_engine(**options: Any) -> ModerationEngine:
    """Creates an engine. Options mirror the JavaScript API in snake_case (``mode``, ``policy``, ...)."""
    return ModerationEngine(**options)
