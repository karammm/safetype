from __future__ import annotations

import pytest

import safetype
from safetype import PatternError, create_moderation_engine


def test_reference_example():
    assert safetype.moderate("What the fuck are you doing?").text == "What the f*ck are you doing?"
    assert safetype.mask("oh shit") == "oh sh*t"


def test_validate_for_server_enforcement():
    engine = create_moderation_engine(mode="block")
    assert engine.validate("hello there").valid is True
    check = engine.validate("you piece of shit")
    assert check.valid is False
    assert [v.rule_id for v in check.violations] == ["en.harassment.piece-of", "en.profanity.shit"]


def test_offsets_are_code_points():
    text = "\U0001F600 fuck"
    match = safetype.moderate(text).matches[0]
    assert text[match.start : match.end] == "fuck"


def test_offset_mapping_round_trip():
    engine = create_moderation_engine(mask_style=lambda s: "[censored]")
    result = engine.moderate("x fuck y")
    assert result.text == "x [censored] y"
    assert result.mapping.to_transformed(7) == 13
    assert result.mapping.to_original(13) == 7


def test_rules_and_policies():
    engine = create_moderation_engine()
    engine.add_rule({"id": "app.frak", "pattern": "frak*", "category": "custom"})
    assert engine.moderate("fraking hell").text == "fr*k*ng hell"
    assert engine.remove_rule("app.frak") is True
    assert engine.remove_rule("app.frak") is False
    engine.set_policy({"profanity": {"action": "block"}})
    assert engine.moderate("shit").allowed is False
    engine.set_policy({"hate": {"min_confidence": 0.1}})
    assert engine.moderate("shit").allowed is False  # earlier override kept
    engine.set_mode("allow")
    assert engine.moderate("shit").allowed is False  # explicit profanity override still applies


@pytest.mark.parametrize(
    "rule, error",
    [
        ({"id": "", "pattern": "x", "category": "custom"}, TypeError),
        ({"id": "a", "pattern": "x", "category": "spam"}, TypeError),
        ({"id": "a", "pattern": "x", "category": "custom", "confidence": 3}, ValueError),
        ({"id": "a", "pattern": "x?", "category": "custom"}, PatternError),
        ({"id": "a", "pattern": "(x|y", "category": "custom"}, PatternError),
    ],
)
def test_invalid_rules(rule, error):
    with pytest.raises(error):
        create_moderation_engine().add_rule(rule)


def test_invalid_configuration():
    with pytest.raises(TypeError):
        create_moderation_engine(mode="explode")
    with pytest.raises(TypeError):
        create_moderation_engine(mask_char="x")
    with pytest.raises(ValueError, match="No built-in dictionary pack"):
        create_moderation_engine(language="xx")
    with pytest.raises(ValueError):
        create_moderation_engine(policy={"hate": {"min_confidence": 2}})


def test_substring_packs():
    engine = create_moderation_engine(
        packs=[{"language": "ja", "boundary": "substring", "rules": [{"id": "ja.x", "pattern": "ばか", "category": "profanity"}]}]
    )
    match = engine.moderate("あなたはばかです").matches[0]
    assert (match.start, match.end, match.text) == (4, 6, "ばか")


def test_idempotent():
    for text in ["What the fuck", "f u c k", "FUUUCK sh1t", "bullshit and bitches"]:
        once = safetype.mask(text)
        assert safetype.mask(once) == once


def test_version_matches_package():
    assert safetype.__version__ == "1.5.1"
