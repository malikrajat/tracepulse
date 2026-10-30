# Publishing

This repository is wired for [Changesets](https://github.com/changesets/changesets)
and GitHub Actions. The short version:

1. Describe your change with `pnpm changeset`.
2. Merge to `main`.
3. The release workflow opens a **Version Packages** PR.
4. Merge that PR → the package is published to npm with provenance.

## One-time setup

### 1. Confirm the npm scope

The package is `@codewithrajat/tracepulse`. The `@codewithrajat` scope belongs to the
publishing account, so no organization setup is needed. If you publish from a different
account, rename the package in `package.json` and update the imports in `README.md`,
`docs/` and the badges.

### 2. Create the npm token

Create a **granular access token** with read/write access to `@codewithrajat`, then add
it to the repository as the `NPM_TOKEN` secret (Settings → Secrets and variables →
Actions).

### 3. Enable GitHub Pages

Settings → Pages → **Source: GitHub Actions**. The `docs.yml` workflow then publishes
the VitePress site on every push to `main`. The site emits meta keywords/description,
an Open Graph title, a `sitemap.xml` and `robots.txt`, and the built-in local search
index, so it is discoverable from search engines and from the docs search box.

## Discoverability

npm and GitHub rank packages by name, description, keywords and repository signals.
TracePulse ships an intentionally large keyword set in `package.json#keywords`
(300+ terms covering request monitoring, observability, fetch/XHR, thresholds,
TypeScript and every supported runtime). Keep it honest: add a keyword only for a
capability the package actually has.

For GitHub discovery, set the repository **About** description and topics
(Settings → General → Topics, or the CLI). GitHub allows up to 20 topics:

```bash
gh repo edit malikrajat/tracepulse \
  --description "Zero-dependency request monitoring and performance observability: fetch/XHR instrumentation, warning/critical thresholds and console reporting." \
  --add-topic request-monitoring \
  --add-topic performance-monitoring \
  --add-topic observability \
  --add-topic apm \
  --add-topic telemetry \
  --add-topic tracing \
  --add-topic fetch \
  --add-topic xhr \
  --add-topic instrumentation \
  --add-topic http \
  --add-topic latency \
  --add-topic typescript \
  --add-topic zero-dependencies
```

`README.md` mirrors the primary terms in its opening paragraph and "Search terms"
line, so both npm and GitHub surface the same vocabulary.

## First release (1.0.0)

TracePulse `1.0.0` has never been published or distributed. The first-release metadata was
reconciled from an unpublished `0.0.0` baseline, and the reviewed `1.0.0` entry in
`CHANGELOG.md` records every user-facing change. No release changesets remain.

::: warning Not published yet
The local `1.0.0` artifacts are prepared for review. Do not publish until the Step 10 and
release-artifact reviews are approved.
:::

The publish commands are:

```bash
pnpm verify                      # check, coverage, pack and package checks
npm publish --dry-run            # inspect the tarball
npm publish --access public
```

`prepublishOnly` runs `vp pack`, so a stale `dist/` can never be published.

## Subsequent releases

```bash
pnpm changeset
```

Choose a bump type and write a one-line description:

| Change                            | Bump    |
| --------------------------------- | ------- |
| Bug fix, docs, internal refactor  | `patch` |
| New exported API, new option      | `minor` |
| Breaking change to the public API | `major` |

Commit the generated `.changeset/*.md` with your code. On `main`, the release
workflow runs `changeset version` (bumps version + `CHANGELOG.md`) in a PR. Merging
it runs `changeset publish`, which:

- publishes to npm with `--access public`,
- creates a git tag,
- creates a GitHub release.

## What gets published

Only the `files` allow-list ends up in the tarball:

```
dist/index.js              ESM (minified)
dist/index.cjs             CommonJS (minified)
dist/index.iife.global.js  IIFE (CDN)
dist/index.d.ts            ESM types
dist/index.d.cts           CommonJS types
README.md, LICENSE, CHANGELOG.md, package.json
```

No source maps are generated. Verify at any time:

```bash
pnpm run check:dist      # entry points, declarations, internal exports
pnpm run check:package   # check:dist + publint --strict + attw + size-limit
pnpm pack --dry-run      # human-readable file list
pnpm run test:browser    # real Chromium smoke test (skips if no browser)
```

`test:browser` uses the built IIFE bundle and a local HTTP fixture. It verifies native
fetch/XHR outcomes, threshold colors and third-party patch preservation. It skips locally
when no browser is installed; CI sets `TRACEPULSE_REQUIRE_BROWSER=1`, so the release gate
fails instead of silently skipping.

## Provenance

The release workflow sets `NPM_CONFIG_PROVENANCE=true` and grants `id-token: write`,
so npm attaches a signed provenance statement linking the tarball to the commit and
workflow that produced it. This requires a public repository; the badge appears on
the npm package page.

## Versioning policy

- Pre-1.0 is over; from `1.0.0` onward, follow SemVer strictly.
- Deprecations: mark with `@deprecated` in JSDoc, announce in the changeset, remove
  in the next major.
- Never change published tarballs. If something is broken, publish a new patch.

The first-release changesets have already been consumed, so there are no pending release
changesets. On a working tree that differs from the base branch, `pnpm changeset status`
exits with code 1 and reports "Some packages have been changed but no changesets were found";
that is expected for this first release. Do not add an empty changeset to silence it. For
later releases, commit a changeset with each user-facing change; `changeset status` can then
confirm the projected bump before merging.

## Release checklist

- [ ] `pnpm verify` passes
- [ ] `pnpm run test:browser` passes (or is intentionally skipped)
- [ ] No unintended pending changesets remain for the release commit
- [ ] README / docs updated for new options or exports
- [ ] Threshold-schema guidance reflects the pre-release numeric form and the
      `requestDurationMs` → `timeToResponseMs` rename, if relevant
- [ ] `CHANGELOG.md` matches the prepared `1.0.0` entry
- [ ] `package.json#version` is `1.0.0` and matches the intended tag
