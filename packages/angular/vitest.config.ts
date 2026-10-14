import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The monorepo also contains a newer Angular (examples/angular-app). Make every import of an
    // Angular package, including Angular's own internal ones, resolve to this package's Angular 19.
    dedupe: [
      "@angular/core",
      "@angular/compiler",
      "@angular/common",
      "@angular/forms",
      "@angular/platform-browser",
      "@angular/platform-browser-dynamic",
      "rxjs",
      "zone.js",
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    server: { deps: { inline: [/@angular/] } },
  },
});
