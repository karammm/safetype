# Support policy

## Versions

SafeType follows [semantic versioning](https://semver.org). All `@safetype/*` packages and the Python package share
one version number.

| Version | Status |
| --- | --- |
| Latest minor (`1.x`) | Bug fixes, dictionary corrections and security fixes |
| Previous minor | Security fixes for 3 months after the next minor ships |
| Older | Unsupported. Please upgrade (minor releases never break your code) |

Breaking changes wait for a major version, which will come with a migration guide and at least 6 months of
security fixes for the last 1.x release.

## Platforms

| | Supported |
| --- | --- |
| Node.js | 18, 20, 22, 24 (tested in CI) |
| Python | 3.9 – 3.13 (tested in CI) |
| Browsers | Current Chrome, Edge, Firefox and Safari (tested in CI with Chromium, Firefox and WebKit) |
| React | 17+ (CI tests React 18) |
| Vue | 3.3+ (CI tests Vue 3.5) |
| Angular | 19+ (CI tests Angular 19 and 22) |
| Solid | 1.8+ (CI tests Solid 1.9) |

## Getting help

- **Questions and ideas:** [GitHub Discussions](https://github.com/karammm/safetype/discussions).
- **Bugs, missed words, false positives:** [open an issue](https://github.com/karammm/safetype/issues/new/choose)
  using a template.
- **Security issues:** [report privately](https://github.com/karammm/safetype/security/advisories/new). Do not open
  a public issue.

SafeType is maintained by volunteers. Issues get a first response within a week where possible, and security
reports within 3 business days.
