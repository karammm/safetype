# safetype (Python)

Rule-based content moderation for Python servers: profanity, hate speech and harassment.
It's the **same engine and dictionaries** as the [SafeType.js](https://github.com/karammm/safetype)
JavaScript packages, so your backend can re-check exactly what the browser checked.
It has no dependencies and runs fully offline.

```bash
pip install safetype
```

```python
from safetype import create_moderation_engine

engine = create_moderation_engine(mode="mask")
engine.moderate("What the fuck are you doing?").text
# 'What the f*ck are you doing?'
```

## Server-side enforcement

Client-side moderation can be bypassed (devtools, curl, modified clients). Re-check before you store:

```python
engine = create_moderation_engine(
    mode="mask",
    policy={"hate": {"action": "block"}, "harassment": {"action": "block"}},
)

check = engine.validate(comment)
if not check.valid:
    raise ValidationError([v.category for v in check.violations])
store(check.result.text)                      # profanity masked
if check.result.requires_review:
    queue_for_human_review(comment)           # e.g. quoted or reported speech
```

FastAPI:

```python
@app.post("/comments")
def create_comment(body: CommentIn):
    check = engine.validate(body.text)
    if not check.valid:
        raise HTTPException(422, detail=[{"category": v.category, "rule": v.rule_id} for v in check.violations])
    return save(check.result.text)
```

Django form:

```python
def clean_body(self):
    check = engine.validate(self.cleaned_data["body"])
    if not check.valid:
        raise forms.ValidationError("Please keep it respectful.")
    return check.result.text
```

## What it handles

- Five actions (`allow`, `mask`, `suggest`, `warn`, `block`) and per-category policies
- Profanity is masked deterministically. Hate and harassment rules are lower-confidence signals that context can weaken:
  quoted or reported speech becomes `requires_review` instead of being acted on
- Unicode (accents, full-width, Cyrillic/Greek lookalikes, zero-width), leet (`sh1t`), repeated letters, spaced letters
- No Scunthorpe problem, and masking is idempotent
- English and Hinglish (romanized Hindi: "bhenchod", "chutiya", "teri maa ka...") out of the box;
  `languages=["en"]` turns Hinglish off
- Spanish, French, German, Portuguese and Hindi (Devanagari), opt-in: `languages=["en", "es"]`, `language="pt-BR"`,
  or `language="hi"` (both Hindi scripts)
- Custom words, custom rules, allow lists, mask styles (`vowels`, `partial`, `full`, or a function)

## API

```python
engine = create_moderation_engine(
    mode="mask", language="en", languages=None, categories=None, policy=None, packs=None,
    custom_words=None, allow_list=None, rules=None,
    mask_char="*", mask_style="vowels", detect_spaced_letters=True,
)
engine.moderate(text)   # ModerationResult(text, suggested_text, matches, action, allowed, requires_review, mapping)
engine.mask(text)       # str
engine.validate(text)   # ValidationResult(valid, result, violations)
engine.add_rule({"id": "app.x", "pattern": "(foo|bar*)", "category": "custom"})
engine.remove_rule("app.x")
engine.set_policy({"harassment": {"action": "block", "min_confidence": 0.7}})
engine.set_mode("warn")

safetype.moderate(text); safetype.mask(text)   # shared default engine
```

Offsets (`match.start` / `match.end`) are Python string indices (code points).

## Parity with JavaScript

The test suite replays 684 cases recorded from the JavaScript engine and requires identical results.
The dictionary is exported from the JavaScript build, so both always share the same rules.

## Limitations

Rule-based detection misses novel spellings and sarcasm, and it can flag reclaimed or quoted language.
Treat hate and harassment results as signals for review, not verdicts. Contextual (AI) classifiers
are available in the JavaScript engine and planned for Python.

MIT licensed.
