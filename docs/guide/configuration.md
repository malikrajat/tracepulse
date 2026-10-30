# Configuration

TracePulse is configured with one plain object. `resolveConfig()` merges your overrides
with the built-in defaults and returns a complete, validated configuration.

> **Scope:** this page documents the configuration contract. `createMonitor()` applies it to
> fetch/XHR instrumentation and console reporting; the transport and reporting helpers
> remain internal.

```ts
import { resolveConfig } from '@codewithrajat/tracepulse'

const config = resolveConfig({
  exclude: ['https://analytics.example.com', '/telemetry'],
  thresholds: { timeToResponseMs: { warningMs: 1500, criticalMs: 2500 } },
})

config.thresholds.timeToResponseMs.warningMs // 1500
config.thresholds.timeToResponseMs.criticalMs // 2500
config.thresholds.responseProcessingMs.warningMs // 300 (default preserved)
```

## Defaults

`DEFAULT_CONFIG` is the single source of truth and is deeply frozen at runtime.

| Property                                              | Default     | Type                     |
| ----------------------------------------------------- | ----------- | ------------------------ |
| `enabled`                                             | `true`      | `boolean`                |
| `autoStart`                                           | `true`      | `boolean`                |
| `exclude`                                             | `[]`        | `readonly string[]`      |
| `page.enabled`                                        | `true`      | `boolean`                |
| `page.mode`                                           | `"once"`    | `"once" \| "continuous"` |
| `page.spa`                                            | `false`     | `boolean`                |
| `page.settleMs`                                       | `300`       | `number` (ms)            |
| `page.resources`                                      | `true`      | `boolean`                |
| `page.idleMs`                                         | `300`       | `number` (ms)            |
| `page.thresholds.pageLoadMs.warningMs`                | `3000`      | `number` (ms)            |
| `page.thresholds.pageLoadMs.criticalMs`               | `5000`      | `number` (ms)            |
| `page.thresholds.firstContentfulPaintMs.warningMs`    | `1800`      | `number` (ms)            |
| `page.thresholds.firstContentfulPaintMs.criticalMs`   | `3000`      | `number` (ms)            |
| `page.thresholds.largestContentfulPaintMs.warningMs`  | `2500`      | `number` (ms)            |
| `page.thresholds.largestContentfulPaintMs.criticalMs` | `4000`      | `number` (ms)            |
| `page.thresholds.pageStableMs.warningMs`              | `4000`      | `number` (ms)            |
| `page.thresholds.pageStableMs.criticalMs`             | `8000`      | `number` (ms)            |
| `thresholds.queueMs.warningMs`                        | `100`       | `number` (ms)            |
| `thresholds.queueMs.criticalMs`                       | `300`       | `number` (ms)            |
| `thresholds.timeToResponseMs.warningMs`               | `2000`      | `number` (ms)            |
| `thresholds.timeToResponseMs.criticalMs`              | `3000`      | `number` (ms)            |
| `thresholds.responseProcessingMs.warningMs`           | `300`       | `number` (ms)            |
| `thresholds.responseProcessingMs.criticalMs`          | `500`       | `number` (ms)            |
| `thresholds.uiUpdateMs.warningMs`                     | `500`       | `number` (ms)            |
| `thresholds.uiUpdateMs.criticalMs`                    | `1000`      | `number` (ms)            |
| `ownership`                                           | `{}`        | `OwnershipConfig`        |
| `colors.normal`                                       | `"#22c55e"` | hex color                |
| `colors.warning`                                      | `"#eab308"` | hex color                |
| `colors.critical`                                     | `"#ef4444"` | hex color                |
| `console.enabled`                                     | `true`      | `boolean`                |
| `console.level`                                       | `"all"`     | `ConsoleLevel`           |
| `console.onlyIssues`                                  | `false`     | `boolean`                |
| `console.useColors`                                   | `true`      | `boolean`                |
| `console.showTable`                                   | `true`      | `boolean`                |
| `console.collapsible`                                 | `true`      | `boolean`                |
| `console.replace`                                     | `false`     | `boolean`                |
| `console.panel`                                       | `false`     | `boolean`                |
| `report.enabled`                                      | `true`      | `boolean`                |
| `report.maxEntries`                                   | `500`       | `number`                 |

```ts
import { DEFAULT_CONFIG } from '@codewithrajat/tracepulse'

DEFAULT_CONFIG.thresholds.timeToResponseMs.criticalMs // 3000
```

## General settings

| Property    | Default | Meaning                                                    |
| ----------- | ------- | ---------------------------------------------------------- |
| `enabled`   | `true`  | Whether monitoring is enabled at all.                      |
| `autoStart` | `true`  | Whether monitoring starts automatically on initialization. |

They are separate on purpose: `createMonitor({ autoStart: false })` prepares a monitor, and
`start()` enables it once your application is ready. `enabled: false` makes `start()` a
no-op even when `autoStart` is `true`.

`enabled` is fixed when `createMonitor()` resolves the configuration. V1 has no public
enable/disable method, so a disabled monitor cannot be started later; create a new monitor
(and stop the old one first, if it is running) when the setting must change.

## URL exclusions

`exclude` is an array of strings. The default is an empty array, which monitors every
supported request.

These rules describe URLs that **your application** requests through `fetch()` or
`XMLHttpRequest` — analytics beacons, third-party APIs, and similar. TracePulse itself
exposes no HTTP endpoint, calls no backend and sends no data anywhere.

**Matching semantics (V1):** a request is excluded when its full URL **contains** the rule
as a case-sensitive substring — the same result as `url.includes(rule)`. The URL includes
the query string and fragment. Rules are plain strings, not regular expressions or globs.

| Rule                            | Matches                                        | Does not match                         |
| ------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `https://analytics.example.com` | `https://analytics.example.com/collect?e=view` | `https://cdn.example.com/analytics.js` |
| `/telemetry`                    | `https://app.example.com/telemetry/batch`      | `https://app.example.com/metrics`      |
| `/analytics`                    | `https://app.example.com/v1/analytics?ts=1`    | `https://app.example.com/v1/metrics`   |

Because this is a substring match, `/telemetry` also matches `/telemetry-v2`. Use a more
specific fragment such as `/telemetry/` when that matters.

Validation: `exclude` must be an array of non-empty strings. An empty or whitespace-only
entry is rejected, because it would match every URL.

> Filtering is performed by request instrumentation; this page defines the matching rules.

## Thresholds

Every metric has two explicit durations in **milliseconds**: a warning boundary and a
critical boundary. Both must be finite, non-negative numbers, and `warningMs` must be
**strictly less** than `criticalMs`. There is no formula that derives one boundary from the
other.

Classification semantics:

- **normal** — below `warningMs`;
- **warning** — at or above `warningMs`, but below `criticalMs`;
- **critical** — at or above `criticalMs`.

| Category               | Warning default | Critical default | What it measures                                                       |
| ---------------------- | --------------- | ---------------- | ---------------------------------------------------------------------- |
| `queueMs`              | `100`           | `300`            | Wait between the request entering the queue and being dispatched.      |
| `timeToResponseMs`     | `2000`          | `3000`           | Wait between dispatch and response headers.                            |
| `responseProcessingMs` | `300`           | `500`            | Observed response-body duration, where measurable.                     |
| `uiUpdateMs`           | `500`           | `1000`           | Time from observed completion to an explicitly marked UI-update point. |

The defaults are explicit values, not a ratio. The old single numbers are preserved as the
**critical** boundaries; warning boundaries are set earlier per category. The pre-release
`requestDurationMs` key is renamed to `timeToResponseMs`.

The four categories describe one continuous timeline:

- `queueMs` is `sentAt - queuedAt`. XHR measures `open()` → `send()`; fetch measures the
  short hand-off between the call and the native transport accepting it.
- `timeToResponseMs` is `responseStartedAt - sentAt`, so it excludes the queue. For `fetch`
  this is the whole observed lifecycle; it is not full body download.
- `responseProcessingMs` is available for XHR as the headers → completion interval. It is
  not application response-processing time, and it is unavailable for fetch.
- `uiUpdateMs` requires a separate UI measurement point. TracePulse does not measure UI
  updates automatically.

::: warning UI timing is not universal
`uiUpdateMs` cannot be measured accurately in every framework without a clearly defined
measurement boundary or an optional integration (for example an explicit mark after a
render). The setting only defines the limits — it does not make exact UI render timing
possible by itself. Fetch and XHR instrumentation do not measure UI updates automatically.
:::

Configuration stores the boundaries only. `createMonitor()` passes the resolved
configuration to the internal threshold evaluator and console reporter.

### Runtime threshold updates

A monitor can change request thresholds while it is running or idle, so an application can
apply an end-user choice (for example a 3 s or 5 s acceptable delay) without stopping and
recreating the monitor:

```ts
const monitor = createMonitor()

monitor.setThresholds({
  timeToResponseMs: { warningMs: 3000, criticalMs: 5000 },
})
```

Each call merges only the supplied boundaries into the current values, so an earlier
override is preserved:

```ts
createMonitor({ thresholds: { queueMs: { warningMs: 50 } } }).setThresholds({
  timeToResponseMs: { warningMs: 3000 },
})
// queueMs.warningMs is still 50
```

Validation is identical to configuration resolution: an invalid update throws `TypeError`
or `RangeError` and leaves the active thresholds unchanged. New measurements are classified
with the updated boundaries; measurements already reported keep the status they were
reported with. Page thresholds are not changed by `setThresholds()` — configure
`page.thresholds` at creation time.

## Ownership labels

TracePulse reports **which phase** is slow. It cannot prove **which team** owns that phase:
the same interval means different things in different applications, and a timing alone never
identifies a team. Ownership is therefore an explicit, optional mapping — there is no
automatic inference and nothing is labelled unless you declare it.

```ts
const monitor = createMonitor({
  thresholds: { timeToResponseMs: { warningMs: 1500, criticalMs: 2500 } },
  ownership: {
    queueMs: 'Frontend',
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Backend',
    uiUpdateMs: 'Frontend',
    serverError: 'Backend',
    clientError: 'API contract',
    failure: 'Network',
  },
})
```

| Key                    | Labels                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| `queueMs`              | A queue breach (`sentAt - queuedAt`).                                 |
| `timeToResponseMs`     | A dispatch → headers breach.                                          |
| `responseProcessingMs` | A headers → completion breach.                                        |
| `uiUpdateMs`           | A breach on an explicitly supplied UI-update interval.                |
| `serverError`          | A response with status `500`–`599`.                                   |
| `clientError`          | A response with a non-2xx status below `500` (for example `404`).     |
| `failure`              | `network-error` or client-side `timeout`. Aborts are not mapped here. |

Rules that keep the label honest:

- **Status beats phase.** A failed request or an error status names its owner even when a
  different phase was the slowest interval.
- **Only flagged requests are labelled.** A healthy request, a near-limit request and an
  unmapped phase show no owner. In the table the `Owner` column appears only when at least
  one key is configured, and an unmapped flagged request reads `unavailable`.
- **Phase labels are a declaration, not a diagnosis.** `timeToResponseMs` covers network,
  server and intermediaries, so `"Backend"` is a responsibility you assigned, not something
  TracePulse measured.
- **Labels are free-form.** Any short, non-empty string is accepted; an empty or
  whitespace-only label is rejected.

`queueMs` deserves its own note: for XHR it is your application's `open()` → `send()` wait, so
a breach usually points at client code. For `fetch` it is the short call → native hand-off
interval, and connection pooling or server queueing after dispatch appears in
`timeToResponseMs` instead.

## Page measurement

Page measurement is browser-only: it is skipped when `window` or
`performance.getEntriesByType` is unavailable, so an SSR process never starts page timers.

| Property         | Default  | Meaning                                                                                     |
| ---------------- | -------- | ------------------------------------------------------------------------------------------- |
| `page.enabled`   | `true`   | Measure and report the page.                                                                |
| `page.mode`      | `"once"` | Capture the initial load once, or keep observing (`"continuous"`).                          |
| `page.spa`       | `false`  | Treat history changes as page boundaries. Continuous mode only.                             |
| `page.settleMs`  | `300`    | Wait after `load` so late resources and LCP entries are included. `0` captures immediately. |
| `page.resources` | `true`   | Include Resource Timing totals for subresources.                                            |
| `page.idleMs`    | `300`    | Quiet window after the last observed activity before the page counts as stable.             |

```ts
const monitor = createMonitor({
  // Non-SPA: one bounded page report at load.
  page: { settleMs: 500 },
})

const spa = createMonitor({
  // SPA: a new soft-navigation segment on every history change.
  page: { mode: 'continuous', spa: true },
  thresholds: { timeToResponseMs: { warningMs: 1000, criticalMs: 2000 } },
})
```

`page.spa` is explicit on purpose. Client-side route changes emit no Navigation Timing entry,
so TracePulse treats `pushState` / `replaceState` / `popstate` / `hashchange` as segment
boundaries only when you ask for it. A soft-navigation segment has no browser `load` or paint
milestones; its reported duration is the observation window and is labelled `observed`.

Page thresholds classify total load, render, FCP, LCP and page stability independently. The worst
status colors the `PAGE` header. Byte totals combine Navigation Timing (document) with Resource
Timing (subresources); entries whose sizes are unavailable are reported as `without sizes` rather
than counted as zero. `page.resources: false` keeps the navigation/paint report and zeroes the
resource totals.

The report also answers three totals that no single browser metric provides:

- **Render** — navigation start → LCP, falling back to FCP when LCP was not observed.
- **Stable** — navigation start → the end of the last observed activity burst, confirmed by a
  `page.idleMs` quiet window. If that window had not completed at capture, the value stays
  unavailable rather than being guessed. Keep `idleMs` at or below `settleMs`.
- **API busy / span** — network time for the monitored requests. `busy` counts overlapping
  requests once (two parallel 2 ms calls are 2 ms, not 4 ms); `span` is the wall-clock distance
  from the first start to the last completion.

`page` also respects the top-level `exclude` list: a Resource Timing entry whose URL contains
an exclusion rule is left out of the resource totals.

`Monitor.page()` returns the current snapshot. `Monitor.reportPage()` captures and prints one
on demand. With `page.mode: "once"`, `page()` keeps returning the captured load after
`stop()`.

## Status colors

Colors are used by the console reporter and are independent of the threshold values:
thresholds decide _which_ status applies, colors decide _how_ it looks.

Supported formats are hex colors: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (case
insensitive). Anything else is rejected.

```ts
// Shorthand is fine; the defaults use 6-digit values for precision.
resolveConfig({ colors: { normal: '#2c5', critical: '#f00' } })
```

| Property          | Default              |
| ----------------- | -------------------- |
| `colors.normal`   | `"#22c55e"` (green)  |
| `colors.warning`  | `"#eab308"` (yellow) |
| `colors.critical` | `"#ef4444"` (red)    |

## Console preferences

| Property              | Default | Meaning                                                                   |
| --------------------- | ------- | ------------------------------------------------------------------------- |
| `console.enabled`     | `true`  | Write measurement reports to the console.                                 |
| `console.level`       | `"all"` | Minimum severity to print: `"all"`, `"warning"`, `"critical"` or `"off"`. |
| `console.onlyIssues`  | `false` | Hide healthy requests and print only what needs attention.                |
| `console.useColors`   | `true`  | Apply CSS colors to headers and summaries.                                |
| `console.showTable`   | `true`  | Print a structured row for the request.                                   |
| `console.collapsible` | `true`  | Put each report in an expandable/collapsible console group.               |
| `console.replace`     | `false` | Clear the console before the accumulated table, so it updates in place.   |
| `console.panel`       | `false` | Render the session in a collapsed in-page panel instead of the console.   |

Reporting runs while a monitor is active. When `console.enabled` is `false`, the reporter
calls no console method. When `console.showTable` is `false`, the summary is still written
but no table row is produced. When `console.useColors` is `false`, the output is plain text.
Unavailable metrics are never coloured as normal.

`console.level` selects a minimum severity rather than a debug/trace channel: a report is
`warning` when a phase, an error status or an abort needs attention, and `critical` when a
phase breaches its critical boundary, the request failed or the response is a 5xx.

| Level        | Printed                                                    |
| ------------ | ---------------------------------------------------------- |
| `"all"`      | Every terminal request and page report (default).          |
| `"warning"`  | Warnings and criticals only; healthy requests stay silent. |
| `"critical"` | Criticals only.                                            |
| `"off"`      | Nothing, even when `console.enabled` is `true`.            |

Reports below the level are still accumulated, so trend and count calculations keep their
history, but they never write a header, table or summary line. With `replace: true`, hidden
entries are also excluded from the redrawn session table and summary.

`console.onlyIssues` is a separate **pass/fail** filter, independent of `console.level`. Set
it when you want to keep the severity floor at `"all"` but stop printing green requests:

```ts
createMonitor({ console: { onlyIssues: true } })
```

A request is printed only when it carries a signal: it is `warning` or `critical`, it failed
or returned an HTTP error, or a phase is still normal but within 20% of its warning boundary
(the `watch` / `near limit` signal). A request fully within its thresholds is accumulated for
trends, deltas and counts but never printed. `unavailable` is not treated as healthy, so an
unmeasured request is kept.

| Configuration                             | Printed                                                     |
| ----------------------------------------- | ----------------------------------------------------------- |
| `{ onlyIssues: true }`                    | Warnings, criticals, failures and near-limit requests.      |
| `{ onlyIssues: true, level: 'critical' }` | Criticals only; the stricter filter wins.                   |
| `{ onlyIssues: false, level: 'warning' }` | Warnings and criticals; near-limit requests are suppressed. |

Both filters apply together, so the stricter one wins. Unlike `level: "critical"`,
`onlyIssues` keeps a warning-classified failure (a 4xx or an abort) visible while hiding
healthy requests. The filter covers the table, the summary, a `replace` redraw, page reports
and the in-page panel. It never affects exported reports, which always include every
measurement.

A build can choose the default level without any runtime code:

```sh
TRACEPULSE_LOG_LEVEL=warning pnpm build
```

The value is inlined as `__LOG_LEVEL__` and becomes the default for `console.level`. An
unrecognised value falls back to `all`, and an explicit `console.level` always wins.

By default the reporter appends **one collapsed group per request**: one visible line per
request, expandable to reveal that request's table row and the session summary. This avoids
reprinting a growing table after every request. A timing that increased since the previous
sample of the same endpoint is highlighted in the group header. Set
`console.collapsible: false` to write the header as a plain line instead.

With `console.replace: true`, the reporter instead keeps every terminal request and redraws
the complete accumulated table after `console.clear()`; the newest table therefore always
contains every API. Clearing also removes the application's own console output, so this is
opt-in and takes precedence over `collapsible`. The summary lists only requests that need
attention.

### The in-page panel

A browser console cannot remove or update a single entry: `console.clear()` is the only
erase API, and it also discards the application's own logs. A table that gains a row per
request therefore either floods the console with copies or forces a full clear.

`console.panel: true` avoids both. The reporter appends one overlay to the document on the
first report, keeps it **collapsed by default**, and updates that same panel in place:

```ts
const monitor = createMonitor({
  console: { panel: true }, // no console.table, no console.clear
})
```

Expanding the panel shows the session summary, the page report and one table row per
request. A repeated URL is never merged: the second, third and fifth call each get their own
row. The console is not written to at all, so the application's own output is untouched.
The panel honours `enabled`, `level`, `useColors` and `showTable`, and takes precedence over
`replace` and `collapsible`, which describe console output only. In a runtime without a DOM
(SSR, a worker) the reporter falls back to the console modes above, so no report is lost.

## Report retention

`Monitor.getReport()` takes a snapshot of the terminal measurements retained for export.
Retention is independent of console output, so a report can be produced with
`console.enabled: false`.

| Property            | Default | Meaning                                                                         |
| ------------------- | ------- | ------------------------------------------------------------------------------- |
| `report.enabled`    | `true`  | Retain terminal measurements for export.                                        |
| `report.maxEntries` | `500`   | Maximum retained measurements; the oldest are dropped first. `0` keeps nothing. |

```ts
const monitor = createMonitor({
  report: { maxEntries: 1000 },
  console: { enabled: false },
})

const snapshot = monitor.getReport()
```

The snapshot contains the measurements plus the thresholds, colours and ownership mapping
that were active when it was taken. It is deliberately unclassified: the opt-in
`@codewithrajat/tracepulse/report` entry turns it into HTML or JSON. See
[Reporting](/guide/reporting) for the renderers, the opt-in shortcut and the privacy model.

The store survives `stop()`/`start()` and is bounded; `monitor.clearMeasurements()` empties
it without affecting the console reporter's own history.

## Nested overrides

`resolveConfig()` merges each group **per property**, and each threshold category merges
its warning and critical boundaries independently. You only specify what you want to
change:

```ts
const config = resolveConfig({
  thresholds: { timeToResponseMs: { warningMs: 1500 } },
  console: { showTable: false },
})

config.thresholds.timeToResponseMs.warningMs // 1500
config.thresholds.timeToResponseMs.criticalMs // 3000 (default preserved)
config.thresholds.responseProcessingMs.warningMs // 300
config.thresholds.uiUpdateMs.criticalMs // 1000
config.colors.warning // "#eab308"
config.console.useColors // true
```

`exclude` is replaced, never concatenated:

```ts
resolveConfig({ exclude: ['/telemetry'] }).exclude // ["/telemetry"]
```

## Pre-release numeric thresholds

`1.0.0` is the first public release, so there is no published single-number API to migrate
from. An earlier unreleased development build accepted one number per category under the keys
`requestDurationMs`, `responseProcessingMs` and `uiUpdateMs`. V1 renames `requestDurationMs`
to `timeToResponseMs` and requires a pair for every category. Both the old key and the numeric
form are **rejected**, not reinterpreted:

```ts
// Unreleased development form: one number per category under the old key
resolveConfig({ thresholds: { requestDurationMs: 3000 } })
// TypeError: config.thresholds.requestDurationMs is no longer supported;
// use config.thresholds.timeToResponseMs with { warningMs, criticalMs }

resolveConfig({ thresholds: { timeToResponseMs: 2000 } })
// TypeError: config.thresholds.timeToResponseMs must be a plain object, received 2000
```

Supply both boundaries explicitly:

```ts
// V1: choose the warning and critical boundaries
resolveConfig({
  thresholds: { timeToResponseMs: { warningMs: 2000, criticalMs: 3000 } },
})
```

The numeric value cannot be mapped automatically: it is ambiguous whether it meant a warning
or a critical limit, and deriving the other boundary would invent a product rule. Apply the
same translation to `responseProcessingMs` and `uiUpdateMs`. See
[Threshold pairs](/guide/migration) for the complete V1 schema, pre-release before/after
examples and error messages.

## Validation

Raw input is validated when the configuration is resolved, before it is merged; the merged
threshold pairs are validated again afterwards. Invalid input never produces a valid-looking
configuration and is never coerced.

| Problem                                                              | Error        |
| -------------------------------------------------------------------- | ------------ |
| Wrong type, wrong shape, invalid color string, non-string exclusion  | `TypeError`  |
| `NaN`, `±Infinity`, negative threshold, or `warningMs >= criticalMs` | `RangeError` |

Messages name the offending path:

```ts
resolveConfig({ thresholds: { timeToResponseMs: { warningMs: -1 } } })
// RangeError: config.thresholds.timeToResponseMs.warningMs must be greater than or equal to 0, received -1

resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000, criticalMs: 3000 } } })
// RangeError: config.thresholds.timeToResponseMs.warningMs must be less than config.thresholds.timeToResponseMs.criticalMs, received 3000 and 3000

resolveConfig({ colors: { normal: 'green' } })
// TypeError: config.colors.normal must be a hex color (#rgb, #rgba, #rrggbb or #rrggbbaa), received "green"
```

A partial override is validated after merging, so it cannot silently cross the default
boundary:

```ts
resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000 } } })
// RangeError: ... warningMs must be less than ... criticalMs, received 3000 and 3000
```

Additional rules:

- `undefined` means "not provided" and falls back to the default.
- Unknown keys are ignored, so configuration objects can be shared across versions. The
  removed `requestDurationMs` key is the deliberate exception: it is rejected by name rather
  than silently ignored.
- The resolver is pure: it does not mutate `DEFAULT_CONFIG` or your object, and the
  returned configuration shares no mutable arrays or nested objects with either.

## Extensibility

Future capabilities (resource monitoring, richer filters, additional measurements, new
reporting destinations) can be added as new optional settings or new nested groups.
Per-property merging means adding a property to an existing group is not a breaking change
for callers.

## Complete example

```ts
import { resolveConfig, type MonitorConfig } from '@codewithrajat/tracepulse'

const config: MonitorConfig = resolveConfig({
  enabled: true,
  autoStart: false,
  exclude: ['https://analytics.example.com', '/telemetry', '/analytics'],
  thresholds: {
    timeToResponseMs: { warningMs: 1500, criticalMs: 2500 },
    responseProcessingMs: { warningMs: 200, criticalMs: 400 },
    uiUpdateMs: { warningMs: 400, criticalMs: 800 },
  },
  ownership: {
    queueMs: 'Frontend',
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Backend',
    uiUpdateMs: 'Frontend',
    serverError: 'Backend',
    clientError: 'API contract',
    failure: 'Network',
  },
  colors: {
    normal: '#22c55e',
    warning: '#f59e0b',
    critical: '#dc2626',
  },
  console: {
    enabled: true,
    useColors: true,
    showTable: false,
  },
  report: {
    enabled: true,
    maxEntries: 500,
  },
})
```

## Not implemented in V1

- Per-request UI instrumentation; page-level paint/LCP is measured by page monitoring
- Automatic UI render timing for an individual request (`uiTiming` has no producer)
- Soft-navigation detection by guesswork (opt in with `page.spa`)
- Automatic ownership inference — `ownership` is a declared mapping, never detected
- Multiple simultaneous monitor instances (one active monitor per loaded module instance;
  duplicate package copies and separate realms are not coordinated)
- Public reporter or threshold-evaluator APIs — use `Monitor.getReport()` and the opt-in
  `/report` renderer instead
