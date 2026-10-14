# @safetype/angular

Angular directive, pipe, validator and service for [SafeType.js](https://github.com/karammm/safetype)
content moderation. Standalone APIs, Angular 19+ (tested with 19 and 22, with zone.js and zoneless).

```bash
npm install @safetype/angular
```

## Setup

```ts
bootstrapApplication(AppComponent, {
  providers: [provideSafeType({ mode: "mask", customWords: ["frak"] })],
});
```

`provideSafeType()` is optional. Without it, everything uses a default engine (`mode: "mask"`, English).

## Directive

```html
<textarea safeType [(ngModel)]="text"></textarea>
<input safeType="block" [formControl]="title" #st="safeType">
<div contenteditable="true" safeType [safeTypeMode]="mode" (safeTypeViolation)="track($event)"></div>
```

- Works with `ngModel`, `formControl` and `formControlName`: the form value receives the masked text
- The caret stays put, and a word is moderated once it's finished. Paste, IME and undo are handled
- Shows an accessible message after the element (`role="status"`, `aria-describedby`). `block` sets `aria-invalid` and stops `(ngSubmit)`

| Input | |
|---|---|
| `safeType` | A mode (`"warn"`), an options object, or empty for the app configuration |
| `safeTypeMode`, `safeTypePolicy` | Update live |
| `safeTypeMessages` | `{ warn, block }` as a string or `(result) => string` |
| `safeTypeShowMessages` | Default `true` |
| `safeTypeBlockSubmit` | Default `true` |

Outputs: `safeTypeModerated`, `safeTypeViolation` (when violations change), `safeTypeWarning`,
`safeTypeBlocked` (submission prevented), `safeTypeError`. With `#st="safeType"`, `st.result` and
`st.validate()` are available in the template.

## Validator

```ts
body = new FormControl("", { validators: [safeTypeValidator()] });
// errors: { safeType: { action: "block", violations: [{ category: "harassment", ruleId, start, end }] } }
```

Defaults to `mode: "block"`. Use `safeTypeValidator({ errorOn: "violation" })` to flag any acted-on match.

## Pipe

```html
{{ comment.body | safeType }}             <!-- masks -->
{{ comment.body | safeType: 'suggest' }}  <!-- "What the heck" -->
```

## Service

```ts
const safeType = inject(SafeTypeService);
safeType.moderate(text); safeType.validate(text); safeType.mask(text); safeType.engine;
```

## Rich-text editor

```ts
import { SafeTypeEditorComponent } from "@safetype/angular/editor"; // npm install @safetype/editor
```

```html
<safe-type-editor [formControl]="body" mode="mask" placeholder="Write something..." [maxLength]="2000" />
```

It's a form control (`formControl`, `formControlName`, `ngModel`, `disabled`), or use `[(value)]`.
Outputs: `moderated`, `violation`, `warning`, `blocked`, `editorChange`. See [`@safetype/editor`](../editor/README.md).

Client-side moderation can be bypassed, so re-check on your server with `@safetype/core`.
