# Contributing to TracePulse

Thanks for taking the time to contribute. This document covers the local workflow,
conventions, and what a good pull request looks like.

## Prerequisites

- **Node.js** `^22.18.0 || ^24.11.0 || >=26` (see `.nvmrc`; Node 24 is recommended)
- **pnpm** `11.x` (the exact version is pinned in `package.json#packageManager`)

```bash
corepack enable        # makes pnpm available at the pinned version
pnpm install
```

`pnpm install` also installs the Vite+ Git hook dispatcher (`vp config`) and the
project-local `vp` CLI — no global installation is required.

## Scripts

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `pnpm dev`           | `vp dev` — playground with HMR (imports `src/index.ts` directly)  |
| `pnpm check`         | `vp check` — Oxfmt + Oxlint (type-aware) + type-check in one pass |
| `pnpm check:fix`     | `vp check --fix` — format and autofix lint                        |
| `pnpm test`          | `vp test run` — Vitest                                            |
| `pnpm test:watch`    | `vp test watch`                                                   |
| `pnpm test:coverage` | `vp test run --coverage` (thresholds enforced)                    |
| `pnpm test:browser`  | Real Chromium smoke test; skips when no browser is installed      |
| `pnpm build`         | `vp pack` — ESM, CJS, IIFE and bundled declarations               |
| `pnpm check:dist`    | Verify built entry points and declarations                        |
| `pnpm check:package` | `check:dist` + `publint` + `attw` + `size-limit`                  |
| `pnpm verify`        | The full gate used by CI                                          |
| `pnpm docs:dev`      | VitePress docs site                                               |

## Project layout

```
src/
  index.ts            Public entry point — every export must be re-exported here
  config/             Typed configuration, defaults, resolution, validation
  core/               TracePulse instance, options, errors, public types
  instrumentation/    Internal fetch/XHR interceptors
  models/             Shared request measurement and timing types
  monitor/            Public createMonitor() and Monitor lifecycle
  reporting/          Internal console reporter
  thresholds/         Internal warning/critical evaluator
  utils/              Emitter, id generation, URL and runtime guards
tests/
  unit/               Vitest specs (import from 'vite-plus/test')
  integration/        Public-entry workflow specs
  types/              Compile-time API tests (`*.test-d.ts`)
scripts/              Release checks and the optional browser smoke test
playground/           Manual sandbox, framework-agnostic
docs/                 VitePress documentation site
```

## Making a change

1. Create a branch: `feat/short-description` or `fix/short-description`.
2. Add tests first when fixing a bug or adding behaviour.
3. Keep the public API surface intentional — anything exported from `src/index.ts` is
   part of the contract and must be documented.
4. Run `pnpm verify` before pushing.
5. Add a changeset (see below).

## Commit messages

The project follows [Conventional Commits](https://www.conventionalcommits.org/). The
pre-commit hook runs `vp check --fix` on staged files (see the `staged` block in
`vite.config.ts`), so formatting and lint issues are fixed automatically.

```
<type>(<scope>): <subject>

feat(core): add pause/resume to the lifecycle
fix(emitter): unsubscribe before invoking once listeners
docs: document sampling behaviour
chore(deps): bump vite-plus
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

## Changesets

Every user-facing change needs a changeset — it drives versioning and the changelog:

```bash
pnpm changeset
```

Pick the bump type (`patch`, `minor`, `major`) and describe the change. Commit the
generated Markdown file together with your code.

> From `1.0.0` onward the project follows SemVer strictly: breaking public API changes
> are `major`.

## Release flow

1. Changesets merged into `main` are collected by the release workflow, which opens a
   **Version Packages** pull request.
2. Merging that PR bumps versions, updates `CHANGELOG.md`, and publishes to npm with
   provenance.
3. `NPM_TOKEN` (a granular automation token with publish access to `@codewithrajat`)
   must exist as a repository secret.

## Pull request checklist

- [ ] Tests added or updated
- [ ] `pnpm verify` passes locally
- [ ] Public API changes are documented in the README and/or `docs/`
- [ ] A changeset is included
- [ ] No unrelated formatting churn

## Code style

Everything is enforced by `vp check` (Oxfmt + Oxlint, type-aware). A few principles:

- TypeScript strict mode plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- No runtime dependencies in `src/` — the package must stay dependency-free.
- Do not use DOM or Node.js APIs in `src/core` or `src/utils`; the library runs in
  browsers, workers, Node, Deno and Bun.
- Prefer explicit return types on exported functions.
- Public functions need a short JSDoc block: `@param`, `@returns`, `@throws`, and an
  `@example` where it helps.
- Public types must stay usable on TypeScript 4.7+; avoid TS 5.2+ only syntax such as
  `Symbol.dispose` / `using` in exported declarations.

## Questions

- **Email:** [support@theraterajatmalik.dev](mailto:support@theraterajatmalik.dev)
- **Bug reports and feature requests:** [GitHub issues](https://github.com/malikrajat/tracepulse/issues)
  using one of the templates
- **Security reports:** [SECURITY.md](./SECURITY.md) — never a public issue
