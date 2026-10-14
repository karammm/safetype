import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests mount string templates, which need Vue's runtime compiler build.
  resolve: { alias: { vue: "vue/dist/vue.esm-bundler.js" } },
  define: { __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
  },
});
