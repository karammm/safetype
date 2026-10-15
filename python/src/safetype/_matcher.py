"""Rule compilation, indexing and matching (mirrors matcher.ts)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ._normalize import NormalizedText
from ._pattern import Alternative, Element, PatternError, Run, parse_pattern, runs_match, to_runs
from ._tokenize import Token
from .types import ALL_CATEGORIES, SEVERITY_RANK, RuleDict

DEFAULT_PRIORITY = {"custom": 40, "hate": 30, "harassment": 20, "sexual": 15, "profanity": 10}


@dataclass
class CompiledRule:
    id: str
    category: str
    severity: str
    confidence: float
    priority: int
    replacement: Optional[str]
    label: Optional[str]
    boundary: str
    elements: tuple[Element, ...]


@dataclass
class RawMatch:
    start: int
    end: int
    rule: CompiledRule
    confidence: float
    token_index: Optional[int] = None
    context: str = "direct"
    source: Optional[str] = None


def compile_rule(rule: RuleDict, boundary: str = "word") -> CompiledRule:
    rule_id = rule.get("id")
    if not isinstance(rule_id, str) or not rule_id:
        raise TypeError("Rule requires a non-empty id")
    if not isinstance(rule.get("pattern"), str):
        raise TypeError(f'Rule "{rule_id}" requires a pattern')
    category = rule.get("category")
    if category not in ALL_CATEGORIES:
        raise TypeError(f'Rule "{rule_id}" has unknown category "{category}"')
    severity = rule.get("severity", "medium")
    if severity not in SEVERITY_RANK:
        raise TypeError(f'Rule "{rule_id}" has unknown severity "{severity}"')
    confidence = rule.get("confidence", 1)
    if not (0 <= confidence <= 1):
        raise ValueError(f'Rule "{rule_id}" confidence must be within [0, 1]')
    try:
        elements = parse_pattern(rule["pattern"])
    except PatternError as error:
        raise PatternError(f'Rule "{rule_id}": {error}') from None
    if boundary == "substring" and len(elements) != 1:
        raise PatternError(f'Rule "{rule_id}": substring packs support single-token patterns only')
    return CompiledRule(
        id=rule_id,
        category=category,
        severity=severity,
        confidence=confidence,
        priority=rule.get("priority", DEFAULT_PRIORITY[category]),
        replacement=rule.get("replacement"),
        label=rule.get("label"),
        boundary=boundary,
        elements=elements,
    )


@dataclass
class _Entry:
    rule: CompiledRule
    alt: Alternative


@dataclass
class RuleIndex:
    exact: dict[str, list[_Entry]] = field(default_factory=dict)
    prefix: dict[str, list[_Entry]] = field(default_factory=dict)
    substring: list[CompiledRule] = field(default_factory=list)

    @classmethod
    def build(cls, rules) -> "RuleIndex":
        index = cls()
        for rule in rules:
            if rule.boundary == "substring":
                index.substring.append(rule)
                continue
            for alt in rule.elements[0].alternatives:
                target = index.prefix if alt.prefix else index.exact
                key = alt.key[0] if alt.prefix else alt.key
                target.setdefault(key, []).append(_Entry(rule, alt))
        return index

    def candidates(self, runs: tuple[Run, ...], key: str) -> list[_Entry]:
        out = [e for e in self.exact.get(key, []) if runs_match(runs, e.alt)]
        out += [e for e in self.prefix.get(key[:1], []) if runs_match(runs, e.alt)]
        return out


@dataclass
class _TokenInfo:
    runs: tuple[Run, ...]
    key: str
    blocked: bool


def _token_info(token: Token, allow_list: set[str]) -> _TokenInfo:
    runs = to_runs(token.value)
    return _TokenInfo(runs, "".join(c for c, _ in runs), token.masked or token.value in allow_list)


def _element_matches(element: Element, info: _TokenInfo) -> bool:
    return not info.blocked and any(runs_match(info.runs, alt) for alt in element.alternatives)


def _match_rest(elements, e: int, infos, t: int) -> int:
    """Index of the last token consumed, preferring the longest match, or -1."""
    if e == len(elements):
        return t - 1
    element = elements[e]
    best = -1
    if t < len(infos) and _element_matches(element, infos[t]):
        best = _match_rest(elements, e + 1, infos, t + 1)
    if element.optional:
        best = max(best, _match_rest(elements, e + 1, infos, t))
    return best


def find_matches(index: RuleIndex, normalized: NormalizedText, tokens: list[Token], spaced: list[Token], allow_list: set[str]) -> list[RawMatch]:
    infos = [_token_info(t, allow_list) for t in tokens]
    out: list[RawMatch] = []
    seen: set[tuple[str, int, int]] = set()

    def push(match: RawMatch) -> None:
        key = (match.rule.id, match.start, match.end)
        if key not in seen:
            seen.add(key)
            out.append(match)

    for i, token in enumerate(tokens):
        info = infos[i]
        if info.blocked:
            continue
        seen_rules: set[str] = set()
        for entry in index.candidates(info.runs, info.key):
            rule = entry.rule
            if rule.id in seen_rules:
                continue
            seen_rules.add(rule.id)
            last = _match_rest(rule.elements, 1, infos, i + 1)
            if last < i:
                continue
            push(RawMatch(token.start, tokens[last].end, rule, rule.confidence, token_index=i))

    for token in spaced:
        info = _token_info(token, allow_list)
        if info.blocked:
            continue
        for entry in index.candidates(info.runs, info.key):
            if len(entry.rule.elements) == 1:
                push(RawMatch(token.start, token.end, entry.rule, entry.rule.confidence, token_index=token.first_index))

    text = normalized.text
    for rule in index.substring:
        for alt in rule.elements[0].alternatives:
            at = text.find(alt.value)
            while at != -1:
                n_end = at + len(alt.value)
                push(RawMatch(normalized.starts[at], normalized.ends[n_end - 1], rule, rule.confidence))
                at = text.find(alt.value, at + 1)
    return out
