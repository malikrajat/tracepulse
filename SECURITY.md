# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report vulnerabilities privately through GitHub's
[Security Advisories](https://github.com/malikrajat/tracepulse/security/advisories/new)
form, or email **support@theraterajatmalik.dev**. Please include:

- The affected version(s)
- A minimal reproduction or proof of concept
- The impact you believe it has
- Any suggested fix or mitigation

You can expect an acknowledgement within **72 hours** and an initial assessment
within **7 days**. Once a fix is ready, a patch release is published, the advisory
is made public, and reporters are credited unless they prefer to stay anonymous.

## Scope

`@codewithrajat/tracepulse` is a dependency-free library that performs no network, file
system or DOM access. The most relevant classes of issue are:

- Prototype pollution through unvalidated option or payload objects
- Denial of service through unbounded memory growth
- Supply-chain issues in the build/release pipeline (`pnpm-lock.yaml`, workflows)

## Release integrity

Releases are published from GitHub Actions with
[npm provenance](https://docs.npmjs.com/generating-provenance-statements) enabled,
so every published tarball is cryptographically linked to this repository and
commit.
