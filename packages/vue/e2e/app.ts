import { createApp, ref } from "vue";
import { SafeTypePlugin } from "../src";

const mode = new URLSearchParams(location.search).get("mode") ?? "mask";
const w = window as unknown as { submitted: number };
w.submitted = 0;

createApp({
  setup() {
    const text = ref("");
    const body = ref("");
    const show = ref(true);
    return { text, body, show, mode, submit: () => w.submitted++ };
  },
  template: `
    <form @submit.prevent="submit">
      <input aria-label="directive" v-safe-type="{ mode }" v-model="text">
      <div data-testid="state">{{ text }}</div>
      <SafeTypeTextarea aria-label="component" :mode="mode" v-model="body" />
      <div data-testid="body-state">{{ body }}</div>
      <input v-if="show" aria-label="toggle" v-safe-type:warn><p v-else>hidden</p>
      <button type="button" @click="show = !show">toggle</button>
      <button type="submit">Send</button>
    </form>`,
})
  .use(SafeTypePlugin)
  .mount("#app");
