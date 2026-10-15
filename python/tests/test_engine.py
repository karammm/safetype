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
    assert safetype.__version__ == "1.11.0"


def test_new_language_packs_are_opt_in():
    engine = create_moderation_engine()
    assert engine.moderate("Scheiße puta मादरचोद").matches == []


def test_language_selection():
    assert create_moderation_engine(language="pt-BR").moderate("porra").text == "p*rr*"
    assert create_moderation_engine(languages=["en", "es", "de"]).moderate("fuck, mierda, Scheiße").text == "f*ck, m**rd*, Sch**ß*"
    assert create_moderation_engine(language="hi").moderate("मादरचोद bhenchod").text == "मा***द bh*nch*d"
    assert create_moderation_engine(language="hi-Latn").moderate("मादरचोद bhenchod").text == "मादरचोद bh*nch*d"


def test_devanagari_masks_whole_characters():
    engine = create_moderation_engine(languages=["hi"])
    assert engine.moderate("तू चूतिया है").text == "तू चू*या है"
    assert engine.moderate("हम लड़ रहे हैं").matches == []
    once = engine.mask("चूतिया लंड")
    assert engine.mask(once) == once


_FRAGMENTS = [
    "fuck", "fuuuck", "f u c k", "sh1t", "$hit", "ass", "as", "Scunthorpe", "you are an idiot", "kys", '"',
    "bhenchod", "mierda", "Scheiße", "caralho", "चूतिया", "लड़", "माँ", "़", "́", "​", "ｆｕｃｋ",
    "fuсk", "😀", "*", "f*ck", " ", "\n", ".", "!", "@", "€", "0", "1", "İ", "ß",
]


def _random_text(rnd) -> str:
    parts = []
    for _ in range(rnd.randrange(12)):
        if rnd.random() < 0.7:
            parts.append(rnd.choice(_FRAGMENTS))
        else:
            parts.append(chr(rnd.randrange(0x20, 0x3000)))
    return (" " if rnd.random() < 0.5 else "").join(parts)


@pytest.mark.parametrize("config", [{}, {"languages": ["en", "hi-Latn", "hi", "es", "fr", "de", "pt"]}, {"mask_style": "partial"}])
def test_fuzz_invariants(config):
    import random

    rnd = random.Random(0x5AFE)
    engine = create_moderation_engine(**config)
    for i in range(1000):
        text = _random_text(rnd)
        result = engine.moderate(text)
        assert result.allowed == (result.action != "block"), (i, text)
        for m in result.matches:
            assert 0 <= m.start < m.end <= len(text), (i, text)
            assert m.text == text[m.start : m.end], (i, text)
        masked = engine.mask(text)
        assert engine.mask(masked) == masked, (i, text)
        assert engine.moderate(result.text).text == result.text, (i, text)


@pytest.mark.parametrize("generate", [lambda n: "f" * n, lambda n: "f u " * n, lambda n: "you are " * n, lambda n: "चू" * n])
def test_linear_time_on_adversarial_input(generate):
    import time

    engine = create_moderation_engine(languages=["en", "hi-Latn", "hi", "es", "fr", "de", "pt"])

    def measure(n: int) -> float:
        start = time.perf_counter()
        engine.moderate(generate(n))
        return time.perf_counter() - start

    measure(1_000)
    # Fastest of three runs, 16x apart: linear code takes ~16x as long and quadratic ~256x, so the 64x
    # threshold separates them even on a noisy CI runner. Timings under 2 ms count as 2 ms.
    small = min(measure(1_000) for _ in range(3))
    large = min(measure(16_000) for _ in range(3))
    assert large < max(small, 0.002) * 64
