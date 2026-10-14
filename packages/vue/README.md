# @safetype/vue

Vue 3 directive, components and composables for [SafeType.js](https://github.com/karammm/safetype)
content moderation. Requires Vue 3.3 or later.

```bash
npm install @safetype/vue
```

## Plugin (recommended)

```ts
import { SafeTypePlugin } from "@safetype/vue";

createApp(App)
  .use(SafeTypePlugin, { mode: "mask", customWords: ["frak"] })
  .mount("#app");
```

The plugin shares one engine with the app and registers `v-safe-type`, `<SafeTypeInput>` and `<SafeTypeTextarea>`.

## Directive

Works on any `<input>`, `<textarea>` or contenteditable element, alongside `v-model`:

```vue
<textarea v-safe-type v-model="text" />                 <!-- app configuration -->
<input v-safe-type:block v-model="title" />             <!-- mode shorthand -->
<input v-safe-type="{ mode: 'warn', onViolation }" />   <!-- options -->
```

`v-model` receives the masked text, the caret stays put, and a word is moderated once it's finished.
The directive renders an accessible message after the element. Without the plugin, import `vSafeType`
and register it locally.

## Components

```vue
<SafeTypeInput v-model="text" mode="mask" placeholder="Say something" @violation="track" />
<SafeTypeTextarea v-model="body" :messages="{ warn: 'Please keep it kind' }" />
```

Attributes and listeners pass through to the element. Props: `mode` and `policy` (live), the other engine
options (`customWords`, `language`, …), `engine`, `messages`, `showMessage`, `unstyled`, `blockSubmit`.
Events: `moderation`, `violation`, `warning`, `blocked`, `moderationError`.
A template ref exposes `validate()`, `result`, `focus()` and `el`.

## Composables

```ts
const field = ref<HTMLTextAreaElement>();
const { result, message, validate } = useSafeType(field, { mode: "warn" }); // you render `message`

const preview = useModeration(draft, { mode: "suggest" }); // computed result for any string
provideSafeType({ mode: "warn" });                         // scope an engine to a subtree
const engine = useSafeTypeEngine();
```

## Notes

- Block mode stops `@submit` (including `.prevent` handlers) until the text is fixed.
- Client-side moderation can be bypassed, so re-check on your server with `@safetype/core`.
