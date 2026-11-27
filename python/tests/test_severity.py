"""Severity overrides (mirrors packages/core/test/severity.test.ts)."""

from __future__ import annotations

import pytest

from safetype import create_moderation_engine


def test_raises_a_low_severity_word_above_the_threshold():
    assert create_moderation_engine().moderate("damn it").matches == []
    r = create_moderation_engine(severity={"damn": "medium"}).moderate("damn it")
    assert r.text == "d*mn it"
    assert (r.matches[0].rule_id, r.matches[0].severity) == ("en.profanity.damn", "medium")


def test_word_keys_cover_every_form_of_the_rule():
    e = create_moderation_engine(severity={"damn": "high"})
    assert [m.severity for m in e.moderate("goddamned damning").matches] == ["high", "high"]


def test_a_key_for_a_specific_form_only_affects_that_form():
    e = create_moderation_engine(severity={"damned": "medium"})
    assert [m.text for m in e.moderate("damned damn").matches] == ["damned"]


def test_lowers_a_word_below_the_threshold():
    e = create_moderation_engine(severity={"shit": "low"})
    assert e.moderate("oh shit").matches == []
    assert len(e.moderate("fuck").matches) == 1


def test_rule_ids_win_over_word_keys():
    e = create_moderation_engine(severity={"en.profanity.damn": "critical", "damn": "medium"})
    assert e.moderate("damn").matches[0].severity == "critical"


def test_normalizes_word_keys():
    e = create_moderation_engine(severity={"  DAMN ": "medium"})
    assert e.get_severity_overrides() == {"damn": "medium"}
    assert len(e.moderate("Damn").matches) == 1


def test_applies_to_custom_words():
    e = create_moderation_engine(custom_words=["Voldemort"], severity={"voldemort": "critical"})
    m = e.moderate("Voldemort").matches[0]
    assert (m.rule_id, m.severity) == ("custom.voldemort", "critical")


def test_works_with_per_severity_policies():
    e = create_moderation_engine(policy={"profanity": {"min_severity": "high"}}, severity={"shit": "critical"})
    assert len(e.moderate("shit happens").matches) == 1
    assert e.moderate("bullshit").matches == []


def test_can_be_changed_at_runtime():
    e = create_moderation_engine()
    e.set_severity("damn", "high")
    assert len(e.moderate("damn").matches) == 1
    e.set_severity("en.profanity.fuck", "low")
    assert e.moderate("fuck").matches == []
    assert e.get_severity_overrides() == {"damn": "high", "en.profanity.fuck": "low"}
    assert e.reset_severity("DAMN") is True
    assert e.reset_severity("damn") is False
    assert e.reset_severity("en.profanity.fuck") is True
    assert [m.text for m in e.moderate("damn fuck").matches] == ["fuck"]


def test_keeps_a_rule_id_override_after_the_rule_is_removed():
    e = create_moderation_engine()
    e.set_severity("en.profanity.damn", "high")
    e.remove_rule("en.profanity.damn")
    assert e.reset_severity("en.profanity.damn") is True


def test_rejects_unknown_severities_and_empty_targets():
    with pytest.raises(TypeError, match="Unknown severity"):
        create_moderation_engine(severity={"damn": "extreme"})
    e = create_moderation_engine()
    with pytest.raises(TypeError, match="Unknown severity"):
        e.set_severity("damn", "nope")  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="non-empty"):
        e.set_severity(" ", "high")
