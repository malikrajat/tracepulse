# Console reporter

Internal, framework-agnostic presentation of terminal request measurements. Nothing is
re-exported from `src/index.ts`: `createMonitor()` owns the reporter and passes it to the
transport instrumentation through the existing `onMeasurement` callback.

Source: [`src/reporting/console-reporter.ts`](../../src/reporting/console-reporter.ts).

## Contract

```ts
createConsoleReporter(config: MonitorConfig): ConsoleReporter

interface ConsoleReporter {
  (measurement: RequestMeasurement): void
  reportPageLoad(measurement: PageLoadMeasurement): void
}

reportMeasurement(
  measurement: RequestMeasurement,
  config: MonitorConfig,
  thresholdResults?: MeasurementThresholdEvaluation,
): void
```

`createConsoleReporter()` is a callback with the same shape as the existing
`onMeasurement` sinks. `createMonitor()` passes it straight to
`installFetchInstrumentation()` / `installXhrInstrumentation()`; the reporter adds no
instrumentation and no second observation path:

```ts
const reporter = createConsoleReporter(resolveConfig())

installFetchInstrumentation({ exclude: config.exclude, onMeasurement: reporter })
installXhrInstrumentation({ exclude: config.exclude, onMeasurement: reporter })
```

The callback receives every lifecycle snapshot, but the reporter ignores `pending` and
`headers-received` and adds exactly one entry for the terminal `completed`, `failed` or
`aborted` snapshot. `createConsoleReporter()` keeps every entry for the lifetime of the
closure. By default each report appends one collapsed `console.groupCollapsed` containing a
single-row table and the session summary, so the console does not reprint a growing table.
`console.replace: true` switches to clearing the console and redrawing the accumulated
session table. `console.panel: true` instead renders the session in a collapsed in-page panel
and writes nothing to the console. `reportMeasurement()` is the stateless entry point: it
renders one group (or a plain header plus the row when grouping is unavailable) and accepts
an optional pre-computed evaluation.

## Byte rollups

Each request row shows its declared `Content-Length` (`0 B` when measured, `unavailable` when
absent). The session summary header appends the declared total, a `data` bucket lists the
largest endpoints by declared bytes, and responses without a trustworthy size are grouped under
`unmeasured` rather than counted as zero.

## Page report

`reporter.reportPageLoad(page)` writes a separate `PAGE` group containing the navigation
(`DOMContentLoaded`/`load`), paint milestones (FP/FCP/LCP), byte rollup (document + Resource
Timing) and the request totals collected in the same session. The header is coloured by the
worst of `page.thresholds.pageLoadMs`, `firstContentfulPaintMs` and `largestContentfulPaintMs`.
A `soft-navigation` segment has no browser `load`/paint milestones, so it is labelled
`observed`. Page reporting is idempotent with respect to the request session: it never adds or
mutates request entries.

## In-page panel

`console.panel: true` writes the session to a shadow-root overlay instead of the console.
Browser DevTools exposes no API to remove or update a single entry — `console.clear()` is the
only erase call and it discards the host application's output — so the panel is the only way
to keep one live table that gains a row per request without reprinting or clearing anything.

The panel module (`src/reporting/panel.ts`) is created lazily on the first rendered report and
appends one `tracepulse-panel` element to `document.body` (or `documentElement` when the body
does not exist yet). It starts collapsed: the bar shows the session header only, and the
body — summary, page block and table — is built when the developer expands it. Every update
replaces the previous content in place, so a session never adds console entries or duplicate
panels.

The panel owns no classification logic. The reporter passes finished strings and colors:

- `header` — the summary's first line, shown on the collapsed bar.
- `summary` — the remaining summary lines, one per bucket, with their resolved colors.
- `rows` — one row per request occurrence (never merged by URL), using the same cells as the
  table mode plus a `Severity` column and a `Detail` column. `Detail` carries the group
  header's worst-phase, near-limit and `↑` increase signals.
- `page` — the last page report, retained on the reporter's output state so a later request
  update redraws it instead of dropping it.
- `showTable` — `console.showTable`; when false, the summary and page block are still drawn.

All values are written with `textContent`, so URLs and owner labels are never parsed as HTML.
Styles live in the shadow root, so host CSS cannot restyle the panel. `update()` and panel
construction are wrapped against a hostile or locked-down DOM; a failure returns `undefined`
and the reporter falls back to the console mode.

## Group header

The always-visible header carries the request status, endpoint, HTTP status/outcome and the
worst measured phase. A normal phase within 20% of its warning boundary is shown as
`near limit: <phase> <duration> of <boundary>` in the derived elevated colour (halfway
between the configured normal and warning colours), and is kept visible even when another
phase already breaches. Any phase whose duration grew since the previous sample
of the same endpoint is appended as a coloured `↑` delta. Increases that are still normal use
the warning colour; warning and critical increases use their own configured colour. Header
colouring is CSS `%c` and is omitted when `console.useColors` is `false`.

## Table

The same four classified timing columns for every transport:

| Column             | Source / meaning                                                          |
| ------------------ | ------------------------------------------------------------------------- |
| `Method`           | `measurement.method`                                                      |
| `URL`              | `measurement.url` (shown as-is; no redaction is added)                    |
| `Transport`        | `fetch` or `xhr`                                                          |
| `Status`           | HTTP status, or `unavailable` when no response exists                     |
| `Bytes`            | declared `Content-Length`, or `unavailable`                               |
| `Lifecycle`        | `completed`, `failed` or `aborted`                                        |
| `Outcome`          | `success`, `http-error`, `network-error`, `timeout` or `aborted`          |
| `Queue`            | Classified `queueMs` (`sentAt - queuedAt`)                                |
| `Time to response` | Classified `timeToResponseMs` (`responseStartedAt - sentAt`)              |
| `Response body`    | Classified `responseBodyMs` (XHR: headers → transport completion)         |
| `UI render`        | Classified `uiUpdateMs`, only when `uiTiming` was explicitly supplied     |
| `ID`               | Request id, so concurrent requests to the same URL remain distinguishable |

Classification is attached as text in the cell, for example `120 ms (warning)`. This is
intentional: `console.table` does not support reliably coloured individual cells, so the
status is readable when colours are disabled and the header and summary carry the colour.

### Timing semantics

- **The four phases are one timeline.** `queueMs = sentAt - queuedAt`,
  `timeToResponseMs = responseStartedAt - sentAt`,
  `responseBodyMs = responseCompletedAt - responseStartedAt`, and
  `uiUpdateMs = uiTiming.updatedAt - completedAt`. `durationMs` is the observed total from
  the queue boundary.
- **Fetch time is time to response.** Fetch resolves when headers are available, so its
  `timeToResponseMs` is the whole observed lifecycle. Its queue phase is the short hand-off
  between the call and the native transport accepting it.
- **XHR queue is `open()` → `send()`.** This is the application's own wait, not browser
  connection queueing. The body interval is the transport's headers → completion interval,
  never application processing time.
- **UI timing is explicit only.** `UI render` is shown only when the measurement carries
  `uiTiming`; fetch/XHR instrumentation never creates it. No render/paint time is inferred.
- **Unavailable stays unavailable.** A missing duration is rendered as `unavailable`
  (or `unavailable (invalid)` for an invalid supplied duration), never as `0`, never as
  `normal`.
- **HTTP errors are not network failures.** HTTP 404/500 keep `Lifecycle: completed` and
  `Outcome: http-error` with the real status. They are never presented as `network-error`.

## Summary and colours

One multi-line session summary is written with `console.log`. Requests are grouped by
endpoint (method + path, ignoring query/hash), so page-load and interaction-triggered calls to
the same API share one line:

```text
TracePulse [CRITICAL] · 4 requests · 3 endpoints
  care now      GET api.example.com/report — 1 request · HTTP 500 (http-error), Time to response 5020 ms (critical)
  concern       POST api.example.com/checkout — 2 requests · 2 warnings · Time to response 1240 ms (warning)
  watch         GET api.example.com/items — 1 request · close to warning: Time to response 120 ms of 150 ms
```

Buckets, in order:

- **`care now`** — critical timing, HTTP 5xx, network failure or timeout.
- **`concern`** — warning timing, HTTP 4xx or an abort.
- **`watch`** — still normal, but a measured phase is within 20% of its warning boundary.
- **`not improving`** — the second half of the endpoint's samples is at least 25% and 10 ms
  slower than the first half; listed only when the endpoint is not already care/concern.
- **`healthy`** — the rest; shown only when another bucket is present, so a clean session
  collapses to `… · nothing needs attention`.
- **`data`** / **`unmeasured`** — declared byte totals, shown after the health buckets because
  they are informational rather than a severity signal.

Endpoints inside a bucket are ordered worst-first: more critical requests, then more warnings,
then the highest HTTP error status, then the largest overshoot of a warning boundary. `watch`
orders by proximity to the warning boundary and `not improving` by the steepest regression, so
equal entries keep discovery order.

Network failures and timeouts escalate to `critical`; aborts and HTTP 4xx escalate to at least
`warning`; HTTP 5xx escalates to `critical`. The row still keeps its own `Lifecycle`/`Outcome`
values. With `console.useColors` enabled, every summary row gets its own CSS `%c` style from
its bucket severity:

- `care now` — critical colour.
- `concern` — warning colour.
- `watch` and `not improving` — a derived elevated colour halfway between the configured
  normal and warning colours, so a near-limit or degrading state is visually distinct from
  both a healthy row and an outright breach. The colour is computed, not configured, so the
  public `colors` shape stays unchanged.
- `healthy` — normal colour.
- `data` and `unmeasured` — a reset style, deliberately neutral.

`[UNAVAILABLE]` is never coloured as a healthy measurement. With colours disabled the text is
unchanged.

The session is the reporter closure, so every terminal request — regardless of whether it
came from page load, a button click or a collapse/expand handler — is appended to the same
table. A new monitor (or page reload) starts a new session.

## Output policy

- `console.enabled: false` returns before touching any console method. Neither the
  factory nor `reportMeasurement()` calls `console.table`, `console.log`,
  `console.groupCollapsed`, `console.groupEnd`, `console.warn`, `console.error` or
  `console.clear`.
- `console.level: 'off'` is equivalent to `enabled: false`. `'warning'` and `'critical'`
  act as minimum severities: a report below the level is still appended to the session (so
  deltas and trends keep their history) but no console method is called. `replace: true`
  renders only the entries at or above the level, so hidden categories do not reappear in
  the redrawn table or summary. Page reports use the same filter.
- `console.showTable: false` suppresses only the table row; the header and summary remain.
- `console.collapsible: true` (default) writes one collapsed group per request. If the
  console implementation lacks `groupCollapsed`/`groupEnd`, the reporter falls back to a
  plain header line and still prints the row and summary. `console.collapsible: false`
  always uses the plain header.
- `console.replace: true` calls `console.clear()` before the accumulated table, giving a
  literal single updating table. It takes precedence over `collapsible`. It is off by
  default because clearing also removes the host application's console output.
- `console.panel: true` sends the session to the in-page panel and calls no console method.
  It takes precedence over `replace` and `collapsible`; when the runtime has no DOM, the
  reporter falls back to the selected console mode, so a report is never silently lost.
- No request/response bodies, headers, cookies or tokens are read or logged. Only the
  URL, method, transport, status, outcome, durations and request id are reported.
- Every console call is wrapped in `try`/`catch`, and the reporter never mutates the
  measurement, configuration or supplied evaluation. A logging failure cannot change a
  request outcome.

## Tests

`tests/reporting/console-reporter.spec.ts` uses the existing `vite-plus/test` framework
with `console.table` / `console.log` / `console.groupCollapsed` / `console.groupEnd` /
`console.clear` spies restored after every test. Coverage includes:

- the four timing columns for fetch and XHR, including exact labels and per-phase statuses;
- one single-row table per report by default, and the accumulated table with `replace: true`;
- one collapsed group per request, plain-header fallback via `collapsible: false`, and
  id-based row replacement;
- coloured and uncoloured increase deltas for repeated endpoints;
- the session summary: counts, attention entries and the worst status;
- 404/500 as `completed` + `http-error`, and missing/opaque statuses as unavailable;
- normal, warning and critical classifications and configured colours;
- fetch queue/response labelling and the absence of invented body/render timings;
- unavailable metrics never becoming `0` or `normal`;
- `console.enabled: false`, every `console.level` value, `showTable: false`,
  `useColors: false`, `collapsible` and `replace`;
- throwing console methods with an end-to-end fetch instrumentation callback, proving
  resolution and rejection identity are unchanged;
- input immutability;
- the in-page panel (`tests/reporting/console-panel.spec.ts`, against a minimal fake DOM):
  collapsed default, expansion, one row per request occurrence, in-place replacement, the
  page block, `showTable: false`, colored severity cells, text-only rendering of hostile URLs,
  no console calls, and the no-DOM fallback.

These are Node tests with stubbed console methods. They do **not** prove real-browser
console-table/`%c` rendering; the optional `scripts/browser-smoke.mjs` covers that in
Chromium, including the panel's shadow-root rendering, collapsed state and absence of console
calls.

## Files

- `src/reporting/console-reporter.ts` — reporter, grouping, accumulation, formatting and
  isolation.
- `src/reporting/panel.ts` — in-page panel: shadow-root construction, collapse state and
  in-place rendering.
- `src/reporting/index.ts` — internal barrel (not exported from `src/index.ts`).
- `tests/reporting/console-reporter.spec.ts` — focused reporter tests.
- `tests/reporting/console-panel.spec.ts` — panel tests; `tests/reporting/fake-dom.ts` is the
  minimal DOM stand-in they run against.
