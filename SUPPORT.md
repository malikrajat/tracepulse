# Support

Thanks for using **TracePulse**. This page explains where to ask for help, what to
include so the answer arrives faster, and what the project can and cannot support.

## Where to get help

| Need | Channel | Best for |
| ---- | ------- | -------- |
| Something is broken | [Open a bug report](https://github.com/malikrajat/tracepulse/issues/new?template=bug_report.yml) | Reproducible defects in the library |
| An API or behaviour is missing | [Request a feature](https://github.com/malikrajat/tracepulse/issues/new?template=feature_request.yml) | New options, integrations and improvements |
| A question, or integration help | [support@rajatmalik.dev](mailto:support@rajatmalik.dev?subject=TracePulse%20Support) | Setup help, private context, anything that is not a bug |
| A security vulnerability | [Private security advisory](https://github.com/malikrajat/tracepulse/security/advisories/new) | Never a public issue — see [SECURITY.md](./SECURITY.md) |
| Documentation | [README](./README.md) · [docs/](./docs/index.md) | Usage, configuration, API and guides |
| Release history | [CHANGELOG.md](./CHANGELOG.md) | What changed in each version |
| Existing answers | [Search issues](https://github.com/malikrajat/tracepulse/issues?q=is%3Aissue) | Check before opening a new one |

## Before you open an issue

A small amount of detail usually turns a slow back-and-forth into a one-message
fix. Please include:

- **Version** — the `@codewithrajat/tracepulse` version from `package.json` or the
  lockfile.
- **Runtime** — browser, Node.js, Web Worker, Deno or Bun, plus the framework and
  bundler if relevant.
- **Minimal reproduction** — the smallest snippet, repository or StackBlitz that
  shows the problem. Remove application code that is not needed to reproduce it.
- **Expected vs actual behaviour** — what you expected, what happened, and the full
  error including the stack trace.
- **Configuration** — the options passed to `createTracePulse()`, including
  thresholds, exclusions, reporters and plugins.
- **Output** — the console report or an exported HTML/JSON report when the issue is
  about measurement or reporting.

## Scope of support

The project supports the latest `1.x` release line. Older versions are upgraded,
not patched; see [SECURITY.md](./SECURITY.md) for the supported-version policy.

In scope:

- Defects and regressions in the library
- Integration questions for the documented adapters and runtimes
- Documentation errors and gaps
- Feature requests that fit the framework-agnostic, zero-dependency scope

Out of scope:

- Debugging application code, build pipelines or third-party libraries
- Tuning the performance of your backend, network or infrastructure
- Custom development, private forks or bespoke integrations
- Guaranteed response times or commercial SLAs

## Response expectations

Support is provided on a best-effort basis by the maintainer and contributors.
New issues are usually triaged within **3 business days**, and security reports are
handled within the timescales published in [SECURITY.md](./SECURITY.md). Responses
are not guaranteed — clear reproductions and complete environment details are the
fastest route to a fix.

## Contributing

Bug reports, reproductions, documentation fixes and pull requests are all welcome.
Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the local setup, the verification gate
and the conventions used in this repository.

## Stay updated

- Star and watch the [repository](https://github.com/malikrajat/tracepulse) for
  releases and fixes
- Follow the [changelog](https://github.com/malikrajat/tracepulse/blob/main/CHANGELOG.md)
- Subscribe to new releases on [npm](https://www.npmjs.com/package/@codewithrajat/tracepulse)

---

Maintained by [Rajat Malik](https://rajatmalik.dev) · [contact@rajatmalik.dev](mailto:contact@rajatmalik.dev)
