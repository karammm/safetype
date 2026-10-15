# Accessibility

Moderation messages have to work for everyone, including people using screen readers, keyboards, zoom and
high-contrast themes.

## What SafeType does for you

- **Messages are announced.** Warnings and block messages are placed next to the field, linked with
  `aria-describedby`, and announced through a polite live region. Blocked fields also get `aria-invalid="true"`.
- **The caret never jumps.** Masking keeps the caret and selection where they were, so screen reader and
  keyboard users don't lose their place. Undo keeps working.
- **IME input is respected.** Nothing is changed while a composition (Chinese, Japanese, Korean, Hindi
  transliteration…) is in progress.
- **The editor is keyboard friendly.** The toolbar is a labelled `toolbar` whose buttons report `aria-pressed`,
  formatting shortcuts work, moderation messages are announced in a polite status region, and blocked content
  is marked `aria-invalid`.

## Tested on every push

[Automated audits](https://github.com/karammm/safetype/tree/main/apps/playground/e2e) run
[axe-core](https://github.com/dequelabs/axe-core) against the WCAG 2.2 A and AA rules in Chromium, Firefox and
WebKit:

- every state of the playground: empty, a warning, a block message, masked editor content, light and dark
  mode, and every control reachable by keyboard
- every page of this documentation, in light and dark mode, plus a check that no page scrolls sideways on a phone

The 1.10 audit found three contrast issues in the playground (teal links and the selected mode button), which
are fixed.

## Your part

Default message colors are chosen for light backgrounds (6.3:1 and 6.6:1 contrast on white). They use
zero-specificity `:where()` selectors, so your own CSS always wins. On a dark theme, set:

```css
.safetype-message[data-level="warn"] { color: #f5b041; }
.safetype-message[data-level="block"] { color: #f87171; }
```

You can change the text of every message, for example to translate it:

```ts
createSafeType({
  messages: {
    warn: "Esto puede resultar hiriente. ¿Quieres reformularlo?",
    block: "Este texto no se puede enviar. Por favor, reformúlalo.",
  },
});
```

Moderation messages should explain, not shame. Keep them short, specific and kind.
