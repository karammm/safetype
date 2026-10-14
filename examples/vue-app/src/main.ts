import { SafeTypePlugin } from "@safetype/vue";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App)
  // One configuration for the app: mask swearing, block targeted harassment.
  .use(SafeTypePlugin, { mode: "mask", policy: { harassment: { action: "block" } }, customWords: ["frak"] })
  .mount("#app");
