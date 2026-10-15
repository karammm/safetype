# Security Policy

## Supported versions

| Version | Security fixes |
| --- | --- |
| Latest minor (`1.x`) | ✅ |
| Previous minor | ✅ for 3 months after the next minor ships |
| Older | ❌ Please upgrade |

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. We aim to acknowledge reports within 3 business days.

## Scope

In scope: bugs that leak user text (e.g. unexpected network calls), ReDoS or other
algorithmic-complexity attacks on the engine, and bypasses of server-side `validate()`
that come from engine bugs (not from dictionary coverage gaps).

Out of scope: words or phrases the dictionaries do not cover (please open a normal issue),
and bypassing *client-side* moderation, which is inherently bypassable. Enforce on the server.

## Defaults

- No telemetry. User text is never sent anywhere unless you configure a contextual classifier.
- Never ship provider API keys in browser bundles. Proxy through your own server.

## Hardening

- The matcher never backtracks. Adversarial-input tests in CI fail if moderation time grows faster than linearly.
- About 12,000 fuzzed inputs per CI run (JavaScript and Python) check that the engine never throws, offsets stay
  valid, and masking is idempotent.
- CI fails on non-permissive licences or high/critical advisories in production dependencies.
- npm releases are published from GitHub Actions with provenance through trusted publishing (no long-lived tokens).
  Check them with `npm audit signatures`.

