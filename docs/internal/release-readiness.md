# V1 release readiness (Step 10)

Status: **technical verification passes; release metadata is reconciled to `1.0.0` and
prepared for review. Nothing has been published, tagged or pushed.**

This page records the release-readiness checks performed for Step 10. It is an internal
document; the public release instructions remain in
[Publishing](/guide/publishing).

## Verification summary

| Gate                            | Command                  | Result                                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| Format, lint, types             | `pnpm check`             | 113 files formatted; 59 files clean                                |
| Unit + integration tests        | `pnpm test`              | 20 files, 477 tests passed                                         |
| Coverage                        | `pnpm test:coverage`     | 96.94% statements, 90.90% branches, 99.50% functions, 96.91% lines |
| Production build                | `pnpm build`             | ESM, CJS, IIFE, `.d.ts`, `.d.cts` emitted                          |
| Built entry points/declarations | `pnpm run check:dist`    | 5 artifacts verified; internals absent                             |
| Package checks                  | `pnpm run check:package` | `publint --strict`, `attw --profile node16`, size-limit all pass   |
| Documentation site              | `pnpm docs:build`        | VitePress build completed; no dead links                           |
| Real-browser smoke              | `pnpm run test:browser`  | 10 transport outcomes, threshold colors and lifecycle verified     |
| Full gate                       | `pnpm verify`            | Passed end to end                                                  |

The package remains **12.13 kB brotli** against the 13 kB limit.

`pnpm changeset status` exits with code 1 on a working tree that differs from the base because
it reports "Some packages have been changed but no changesets were found". That is expected for
the first-release commit; the pre-release changeset drafts were folded into the `1.0.0`
changelog and removed.

## What the release validates

### Public workflow

- `createMonitor()` is imported from the package root and exercised through its public
  `Monitor` interface.
- Fetch and XHR success, HTTP error (including explicit 404 and 500), network error,
  timeout and abort outcomes are covered.
- Warning and critical threshold boundaries are checked with a controlled clock, including
  every classification band for `timeToResponseMs` and `responseProcessingMs`, plus
  console CSS colors.
- Start, stop, restart, rollback, retry, concurrent requests and third-party fetch patch
  preservation are covered.
- The XHR rollback path is tested with a third-party fetch patch installed during the
  failure window; the retry wraps the third-party function and does not replace it.

### Generated package

`scripts/check-dist.mjs` verifies:

- `dist/index.js`, `dist/index.cjs`, `dist/index.iife.global.js`, `dist/index.d.ts` and
  `dist/index.d.cts` exist.
- `package.json` export branches and required metadata are intact.
- ESM and CJS builds expose `createMonitor` at runtime.
- Installers, reporter factories, threshold evaluators and the monitor class are not
  exported.
- Both declaration files declare `createMonitor` and `Monitor` and contain none of the
  internal names.
- The IIFE bundle exposes the `TracePulse` global.

`publint` and `attw` additionally validate the packed tarball from a consumer's
perspective. `pnpm pack --dry-run` contains only the five dist artifacts plus
`package.json`, `README.md`, `LICENSE` and `CHANGELOG.md`; tests, scripts and source files
are not published.

### Real browser

`scripts/browser-smoke.mjs` serves the built IIFE bundle and drives it with headless
Chromium (Google Chrome 155.0.8059.85 in the verification run). It covers native XHR
event ordering, real fetch rejection names, 503 responses, resets, timeouts, aborts,
threshold colors and third-party patch preservation. It is Chromium-only and verifies the
reporter's arguments, not visually rendered console CSS. The script
skips when no Chrome/Chromium is installed locally; CI sets
`TRACEPULSE_REQUIRE_BROWSER=1`, so a missing browser fails the release gate.

## Versioning decision: first public release is `1.0.0`

Confirmed by the repository owner: TracePulse `1.0.0` has never been published or
distributed. The public registry metadata lookup on 2026-10-22 also returned **HTTP 404** for
`@codewithrajat/tracepulse`; there are no local git tags and no configured remote.

The first-release notes are consolidated in the `1.0.0` entry of `CHANGELOG.md`. The
pre-release changeset drafts were folded into that entry and removed, so the first publish is
`1.0.0` rather than a changeset-driven bump from an unpublished baseline.

No release changesets remain. `pnpm changeset status` exits with "Some packages have been
changed but no changesets were found" on a working tree that differs from the base; that is
expected for this first-release commit. Do not add an empty changeset to silence it.

## Remaining manual release checks

- [ ] Review the prepared `CHANGELOG.md` `1.0.0` entry and docs updates.
- [ ] Confirm `NPM_TOKEN` and GitHub Pages setup.
- [ ] Run `pnpm verify` and `pnpm run test:browser` on the release commit.
- [ ] Approve publishing, tagging and GitHub release creation.
- [ ] Do not publish until the Step 10 and release-artifact reviews are approved.
