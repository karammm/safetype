import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";

const { version } = JSON.parse(readFileSync(new URL("../../../packages/core/package.json", import.meta.url), "utf8"));

export default defineConfig({
  title: "SafeType.js",
  description: "Open-source content moderation for JavaScript and Python: profanity, hate speech and harassment, as people type.",
  base: "/safetype/docs/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#0a7a6b" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/safetype/docs/mark.svg" }],
    ["meta", { property: "og:image", content: "https://karammm.github.io/safetype/docs/social-preview.png" }],
    ["meta", { property: "og:image:width", content: "1280" }],
    ["meta", { property: "og:image:height", content: "640" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],
  // The default GitHub themes have comment and keyword colors below WCAG AA contrast.
  markdown: { theme: { light: "github-light-high-contrast", dark: "github-dark-high-contrast" } },
  themeConfig: {
    logo: { src: "/mark.svg", alt: "" },
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "Packages", link: "/packages/core", activeMatch: "/packages/" },
      { text: "Playground", link: "https://karammm.github.io/safetype/" },
      {
        text: `v${version}`,
        items: [
          { text: "Changelog", link: "https://github.com/karammm/safetype/blob/main/CHANGELOG.md" },
          { text: "Roadmap", link: "https://github.com/karammm/safetype/blob/main/ROADMAP.md" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "How moderation works", link: "/guide/concepts" },
          { text: "Engine API", link: "/guide/api" },
          { text: "Languages", link: "/guide/languages" },
          { text: "Custom words and rules", link: "/guide/rules" },
          { text: "Server-side enforcement", link: "/guide/server" },
        ],
      },
      {
        text: "Packages",
        items: [
          { text: "@safetype/core", link: "/packages/core" },
          { text: "@safetype/dom", link: "/packages/dom" },
          { text: "@safetype/react", link: "/packages/react" },
          { text: "@safetype/vue", link: "/packages/vue" },
          { text: "@safetype/angular", link: "/packages/angular" },
          { text: "@safetype/solid", link: "/packages/solid" },
          { text: "@safetype/editor", link: "/packages/editor" },
          { text: "@safetype/adapters", link: "/packages/adapters" },
          { text: "@safetype/ai", link: "/packages/ai" },
          { text: "@safetype/dictionaries", link: "/packages/dictionaries" },
          { text: "safetype (Python)", link: "/packages/python" },
        ],
      },
      {
        text: "Quality",
        items: [
          { text: "Accessibility", link: "/guide/accessibility" },
          { text: "Performance", link: "/guide/performance" },
          { text: "Security and privacy", link: "/guide/security" },
          { text: "Limitations and FAQ", link: "/guide/faq" },
          { text: "Support policy", link: "/guide/support" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/karammm/safetype" }],
    search: { provider: "local" },
    editLink: { pattern: "https://github.com/karammm/safetype/edit/main/apps/docs/:path", text: "Edit this page on GitHub" },
    footer: { message: "Released under the MIT License.", copyright: "SafeType.js contributors" },
  },
});
