# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is maintained by [Changesets](https://github.com/changesets/changesets).
Do not edit it by hand - run `pnpm changeset` and let the release workflow update it.

## [1.0.0] - 2026-10-22

First public release of `@codewithrajat/tracepulse`. TracePulse 1.0.0 has not been
published or distributed before this release.

### Added

- Automatic `fetch()` instrumentation. It observes call time, the dispatch boundary, promise
  resolution and rejection, preserves the original `Response` or rejection value, and supports
  request exclusions.
- Automatic `XMLHttpRequest` instrumentation. It patches `open`, `send` and `abort` with
  pass-through wrappers, observes headers and terminal events, preserves the native event
  model, and cleans up listeners after a request settles.
- A shared request measurement model with `pending`, `headers-received`, `completed`,
  `failed` and `aborted` lifecycles; `success`, `http-error`, `network-error`, `timeout` and
  `aborted` outcomes; single-clock timing; and response metadata. HTTP 4xx/5xx responses
  remain `completed` + `http-error`, and each request produces one terminal measurement.
- Queue timing on `RequestTiming` (`queuedAt` / `sentAt`). `getRequestDurations()` now returns
  `queueMs` and computes `durationMs` from the queue boundary, `timeToResponseMs` from
  dispatch, and `responseBodyMs` from headers. `elapsedMs()` remains the reusable primitive
  for any two timestamps.
- Warning/critical threshold evaluation for four non-overlapping phases: `queueMs` (wait
  before dispatch), `timeToResponseMs` (dispatch to headers), `responseProcessingMs` (headers
  to transport completion) and `uiUpdateMs` (completion to an explicitly marked UI update),
  with a distinct `unavailable` result for measurements that were not observed.
- The internal console reporter for terminal requests. By default every terminal request is
  appended as one collapsed group containing a single-row table with the request metadata and
  the `Queue`, `Time to response`, `Response body` and `UI render` timing columns, plus a
  session summary that groups endpoints into `care now`, `concern`, `watch` and
  `not improving`, with a `healthy` count for the rest. Timing increases over the previous
  sample of the same endpoint are highlighted in the group header. `console.enabled`,
  `console.useColors`, `console.showTable`, `console.collapsible` and `console.replace`
  control output; `collapsible: false` writes a plain header instead of a group, and
  `replace: true` clears the console and redraws one accumulated session table (it takes
  precedence over `collapsible`). Status colors are configurable.
- The public request-monitoring lifecycle: `createMonitor(config?)` returns a `Monitor` with
  idempotent `start()` and `stop()`. `enabled` and `autoStart` are supported, `enabled` is
  fixed when the monitor is created, and only one monitor may run per loaded module instance.
  A competing start throws `TracePulseError` with code `INVALID_STATE`.
- Safe stop and restart behavior: `stop()` restores only TracePulse's own wrappers, leaves a
  later third-party `fetch`/XHR patch in place, and does not cancel or re-report in-flight
  requests. Restarting wraps the current transport without duplicate reports.
- `DEFAULT_CONFIG`, `resolveConfig()`, `MonitorConfig` / `MonitorConfigInput`, and the
  configuration type surface for thresholds, colors and console preferences. `exclude`
  defaults to an empty array and matches case-sensitive substrings of the full request URL.
- The existing core primitives: `TracePulse` with its idle/running/stopped/disposed
  lifecycle, `TypedEventEmitter`, stable `TracePulseError` codes, plugins, optional
  sampling, bounded history, and injectable clock/id factory. The core instance is a small
  reference implementation; request monitoring is the fully wired V1 subsystem.
- Dual ESM/CJS builds with bundled `.d.ts` and `.d.cts` declarations, a minified IIFE bundle
  for CDN use, and no runtime dependencies.
- Documentation and examples: a VitePress guide, architecture and migration notes, runnable
  examples for vanilla, React, Angular, Vue, Svelte, Node and SSR, a manual playground, and a
  real-Chromium browser smoke test.

### Changed

- Thresholds are explicit `{ warningMs, criticalMs }` pairs for every category. The
  pre-release `requestDurationMs` key is renamed to `timeToResponseMs`; the old key and the
  single-number form are rejected instead of being ignored or reinterpreted.
- `console.collapsible` defaults to `true`, so a long session adds one collapsed group per
  request instead of reprinting a growing table. `console.replace` defaults to `false`.

### Threshold configuration

- The finalized V1 schema uses explicit pairs for every duration category:
  `queueMs` defaults to `{ warningMs: 100, criticalMs: 300 }`, `timeToResponseMs` to
  `{ warningMs: 2000, criticalMs: 3000 }`, `responseProcessingMs` to
  `{ warningMs: 300, criticalMs: 500 }`, and `uiUpdateMs` to
  `{ warningMs: 500, criticalMs: 1000 }`.
- `resolveConfig()` merges each boundary independently. Boundaries must be finite and
  non-negative, and the merged pair must satisfy `warningMs < criticalMs`; equal or reversed
  pairs are rejected.
- `DurationThreshold` and `DurationThresholdInput` are exported from the package root.
- A single-number threshold form and the pre-release `requestDurationMs` key existed only
  during unreleased development. Both are rejected by the final V1 schema rather than
  reinterpreted, so an old configuration cannot silently keep the default boundaries. There
  is no migration from a previously published TracePulse 1.x release.

### Known limitations

- Browser verification covers Chromium only. Firefox and WebKit behavior was not verified,
  and the browser smoke test checks reporter arguments rather than visually rendered
  console CSS.
- `uiUpdateMs` is configurable and evaluable, but fetch and XHR instrumentation do not
  observe UI updates in V1. No public `uiTiming` input is exposed, so monitor reports show
  the UI-update interval as `unavailable`.
- The one-monitor guard is scoped to the loaded module instance. Duplicate package copies
  and separate JavaScript realms are not globally coordinated.
- Fetch duration is time to response availability (headers), not full response-body
  download time. `responseProcessingMs` for XHR is the interval from headers to transport
  completion, not application processing time.
- `network-error` is a category for a request that ended without a usable HTTP response. It
  does not claim a specific DNS, TLS, CORS or connection cause.
- Response bodies, request bodies, cookies and authorization headers are not stored.
