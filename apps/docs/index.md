---
layout: home

hero:
  name: SafeType.js
  text: Write freely. Communicate respectfully.
  tagline: Open-source moderation for profanity, hate speech, harassment and sexual content, in any text field or editor, as people type. Runs locally, with no telemetry.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Try the playground
      link: https://karammm.github.io/safetype/
    - theme: alt
      text: GitHub
      link: https://github.com/karammm/safetype

features:
  - title: Works with what you have
    details: Plain inputs, React, Vue, Angular, Solid, or the editor you already use (Quill, Lexical, CodeMirror, Monaco, ProseMirror, Tiptap). Or use the built-in rich-text editor.
  - title: Mask, suggest, warn or block
    details: Five actions with per-category policies. Profanity is masked deterministically. Hate and harassment are confidence-scored signals that context can weaken.
  - title: Hard to fool, easy on innocent words
    details: Catches leet, repeated and spaced letters, lookalike characters and zero-width tricks. Whole-word matching means no Scunthorpe problem.
  - title: Seven languages
    details: English and Hinglish by default. Spanish, French, German, Portuguese and Hindi (Devanagari) when you opt in, each with false-positive tests.
  - title: Same rules on the server
    details: Re-check submissions in Node or Python. The Python port passes the same parity suite as the JavaScript engine.
  - title: Optional AI, keys stay on your server
    details: Add Claude or any model for context such as sarcasm, coded insults and threats without swear words. The browser only talks to your endpoint.
---
