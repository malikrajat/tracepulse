# API reference

Everything below is exported from the package root. The package is framework-agnostic:
no DOM, Node.js or framework imports are used at runtime.

## Configuration

```ts
function resolveConfig(input?: MonitorConfigInput): MonitorConfig

const DEFAULT_CONFIG: Readonly<MonitorConfig>
```

| Export                                         | Kind     | Notes                                                                           |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `resolveConfig(input?)`                        | function | Pure merge of defaults + overrides; validates first                             |
| `DEFAULT_CONFIG`                               | const    | Deeply frozen defaults                                                          |
| `MonitorConfig`                                | type     | Fully resolved configuration (all properties required)                          |
| `MonitorConfigInput`                           | type     | Partial input; nested groups accept partials                                    |
| `ThresholdConfig` / `ThresholdConfigInput`     | type     | Four phases, each with explicit `warningMs` and `criticalMs`                    |
| `OwnershipConfig` / `OwnershipConfigInput`     | type     | Declared owner labels per phase and per failure class                           |
| `DurationThreshold` / `DurationThresholdInput` | type     | One explicit warning/critical pair in milliseconds                              |
| `ColorConfig` / `ColorConfigInput`             | type     | `normal`, `warning`, `critical` hex colors                                      |
| `ConsoleConfig` / `ConsoleConfigInput`         | type     | `enabled`, `level`, `useColors`, `showTable`, `collapsible`, `replace`, `panel` |
| `ConsoleLevel`                                 | type     | `"all" \| "warning" \| "critical" \| "off"`                                     |
| `PageConfig` / `PageConfigInput`               | type     | `enabled`, `mode`, `spa`, `settleMs`, `resources`, `thresholds`                 |
| `PageMode`                                     | type     | `"once"` or `"continuous"`                                                      |
| `PageThresholdConfig` / `...Input`             | type     | `pageLoadMs`, FCP and LCP warning/critical pairs                                |
| `ColorValue`                                   | type     | Hex color string (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`)                      |

Defaults: `enabled: true`, `autoStart: true`, `exclude: []`,
`thresholds: { queueMs: { warningMs: 100, criticalMs: 300 }, timeToResponseMs: { warningMs: 2000, criticalMs: 3000 }, responseProcessingMs: { warningMs: 300, criticalMs: 500 }, uiUpdateMs: { warningMs: 500, criticalMs: 1000 } }`,
`page: { enabled: true, mode: 'once', spa: false, settleMs: 300, resources: true, thresholds: { pageLoadMs: { warningMs: 3000, criticalMs: 5000 }, firstContentfulPaintMs: { warningMs: 1800, criticalMs: 3000 }, largestContentfulPaintMs: { warningMs: 2500, criticalMs: 4000 } } }`,
`ownership: {}` (no owner is inferred),
`colors: { normal: '#22c55e', warning: '#eab308', critical: '#ef4444' }`,
`console: { enabled: true, level: 'all', onlyIssues: false, useColors: true, showTable: true, collapsible: true, replace: false, panel: false }`.
The default `console.level` can be set at build time with `TRACEPULSE_LOG_LEVEL`.

`resolveConfig()` throws `TypeError` for wrong types/shapes/color formats and `RangeError`
for negative or non-finite thresholds, or a threshold pair where `warningMs` is not
strictly less than `criticalMs`. See [Configuration](/guide/configuration) for the merge
rules and exclusion matching semantics.

## Request monitoring

```ts
function createMonitor(config?: MonitorConfigInput): Monitor

interface Monitor {
  start(): this
  stop(): this
  page(): PageLoadMeasurement | undefined
  reportPage(): this
  setThresholds(thresholds: ThresholdConfigInput): this
  getReport(options?: ReportOptions): TracePulseReport
  clearMeasurements(): this
}
```

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({ autoStart: false })

fetch('/api/items') // not observed yet

monitor.start()
fetch('/api/items') // observed and reported

monitor.stop()
```

| Behaviour           | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoStart`         | Default `true`: `createMonitor()` installs fetch/XHR instrumentation immediately.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `autoStart: false`  | Creates an idle monitor; call `start()` when ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `enabled: false`    | `start()` is a no-op, even when `autoStart` is `true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `enabled` lifetime  | Read once when the configuration is resolved. V1 has no runtime toggle; create a new monitor to change it.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Idempotency         | Repeated `start()` / `stop()` calls do nothing; both return the monitor for chaining.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Restart             | `stop()` uninstalls; a later `start()` installs again from the current globals.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Third-party patches | A wrapper installed after TracePulse is preserved by `stop()`; restart wraps it and still reports each request once.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Concurrency         | One monitor may run per loaded module instance. A competing `start()` throws `TracePulseError` with code `INVALID_STATE`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Output              | Terminal measurements go through the internal console reporter. By default each request is one expandable group containing its table row and the attention summary; `console.replace: true` switches to one accumulated table redrawn in place, and `console.panel: true` renders the same session in a collapsed in-page panel updated in place without writing to the console at all. `console.enabled`, `console.level`, `console.useColors`, `console.showTable`, `console.collapsible`, `console.replace` and `console.panel` apply. |
| Runtime thresholds  | `setThresholds()` merges request threshold overrides into the current values and returns the monitor. It works while running or idle, validates exactly like `resolveConfig()`, and leaves the active thresholds untouched when the update is invalid. Page thresholds are creation-time only.                                                                                                                                                                                                                                            |

`enabled` is fixed at creation time: `createMonitor({ enabled: false })` resolves and stores
that value, and no public method can change it later. A disabled monitor never claims the
active-monitor slot, so a separate enabled monitor can run alongside it.

The one-monitor guard is scoped to the loaded module instance. Duplicate copies of the
package (for example two versions in one bundle) and separate JavaScript realms are not
globally coordinated, so each copy can start its own monitor.

### In-flight requests after `stop()`

`stop()` does not cancel requests and does not change their results. An in-flight
`fetch()` call resolves or rejects with its original value, and an XHR continues its native
lifecycle. TracePulse only stops observing:

- **fetch** — the pending terminal handler checks that the installation is still active and
  emits no terminal snapshot after `stop()`.
- **XHR** — listeners are detached from every in-flight request, so a late
  `load` / `error` / `abort` event produces no snapshot.

A `pending` snapshot (and, for XHR, a `headers-received` snapshot) delivered before `stop()`
remains delivered; the console reporter ignores non-terminal snapshots. A later `start()`
observes only requests made after it: an in-flight request from before `stop()` is not
re-reported, and no `stop`/`abort` lifecycle event or synthetic terminal snapshot is
invented.

## Reporting

`Monitor.getReport()` returns a frozen snapshot of the retained terminal measurements plus
the thresholds, colours and ownership mapping active at that moment. It does not classify or
render: those steps live in the opt-in `@codewithrajat/tracepulse/report` subpath.

```ts
interface ReportOptions {
  generatedAt?: number // defaults to Date.now()
}

interface TracePulseReport {
  version: string
  generatedAt: number
  page: PageLoadMeasurement | undefined
  measurements: readonly RequestMeasurement[]
  settings: ReportSettings
}
```

```ts
import { createMonitor } from '@codewithrajat/tracepulse'
import {
  createHtmlReport,
  createJsonReport,
  createReportView,
  downloadHtmlReport,
  installReportShortcut,
} from '@codewithrajat/tracepulse/report'

const monitor = createMonitor({ report: { maxEntries: 500 } })

const html = createHtmlReport(monitor.getReport(), { title: 'Weekly latency' })
downloadHtmlReport(html, 'weekly-latency.html')

const json = createJsonReport(monitor.getReport())
const view = createReportView(monitor.getReport())

monitor.clearMeasurements()
```

| Export                               | Kind       | Notes                                                       |
| ------------------------------------ | ---------- | ----------------------------------------------------------- |
| `Monitor.getReport(options?)`        | method     | Raw snapshot; works while running or stopped.               |
| `Monitor.clearMeasurements()`        | method     | Empties the report store; does not affect console history.  |
| `createReportView(snapshot)`         | function   | Classified entries, severities, stages, owners and rollups. |
| `createHtmlReport(snapshot, opts?)`  | function   | Self-contained HTML with inline CSS and search/sort.        |
| `createJsonReport(snapshot, opts?)`  | function   | The classified view as JSON (`pretty` defaults to `true`).  |
| `downloadHtmlReport(html, name?)`    | DOM helper | Blob + `<a download>`; explicit call, no hidden listener.   |
| `installReportShortcut(monitor, o?)` | DOM helper | Opt-in `Ctrl/Cmd+Shift+E` export; returns an unsubscribe.   |

`getReport()` returns raw data; `createHtmlReport()` and `createJsonReport()` accept that
snapshot directly. See [Reporting](/guide/reporting) for retention, report contents and
privacy.

Raw measurements are available through `getReport()`; the reporter factory and transport
installers remain internal.

## Measurement model

Types plus two pure duration helpers. Measurements are produced internally by the fetch/XHR
instrumentation and rendered by the console reporter.

```ts
type RequestMeasurement =
  | PendingRequestMeasurement
  | HeadersReceivedRequestMeasurement
  | CompletedRequestMeasurement
  | FailedRequestMeasurement
  | AbortedRequestMeasurement
```

| Export                                                                                                            | Kind     | Notes                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `RequestMeasurement`                                                                                              | type     | Discriminated union on `lifecycle`                                      |
| `RequestMeasurementBase`                                                                                          | type     | Shared `id`, `url`, `method`, `transport`, `timing`                     |
| `PendingRequestMeasurement` / `HeadersReceivedRequestMeasurement`                                                 | type     | Non-terminal states                                                     |
| `CompletedRequestMeasurement` / `FailedRequestMeasurement` / `AbortedRequestMeasurement`                          | type     | Terminal states                                                         |
| `RequestLifecycleState` / `TerminalRequestLifecycleState`                                                         | type     | State unions                                                            |
| `RequestTiming` / `MonotonicTimestamp`                                                                            | type     | Single-clock timestamps (ms); durations are derived                     |
| `ResponseMetadata`                                                                                                | type     | `status`, `ok`, optional `statusText` / `contentType` / `contentLength` |
| `RequestOutcome`, `SuccessOutcome`, `HttpErrorOutcome`, `NetworkErrorOutcome`, `TimeoutOutcome`, `AbortedOutcome` | type     | Outcome union (`kind` discriminant)                                     |
| `CompletedRequestOutcome` / `FailedRequestOutcome`                                                                | type     | Outcome subsets per terminal state                                      |
| `RequestId`, `RequestTransport`, `HttpMethod`, `UiTiming`                                                         | type     | Identity, transport, method and optional UI timing                      |
| `getRequestDurations(timing)`                                                                                     | function | Returns `{ queueMs?, durationMs?, timeToResponseMs?, responseBodyMs? }` |
| `elapsedMs(from, to)`                                                                                             | function | Difference between any two same-clock timestamps                        |
| `RequestDurations` / `DurationMs`                                                                                 | type     | Helper result and non-negative duration alias                           |

## Page measurement

```ts
interface PageLoadMeasurement {
  id: string
  kind: 'document' | 'soft-navigation'
  url: string
  capturedAt: number
  navigation: PageNavigationTiming
  paints: readonly PagePaintTiming[]
  largestContentfulPaintAt?: number
  stableAt?: number
  resources: PageResourceTotals
}
```

| Export                                        | Kind            | Notes                                                                                                 |
| --------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `PageLoadMeasurement`                         | type            | One page or SPA segment                                                                               |
| `PageNavigationTiming` / `PageNavigationType` | type            | Navigation start, DOMContentLoaded, load, document bytes, kind                                        |
| `PagePaintTiming` / `PageResourceTotals`      | type            | Paint milestones and Resource Timing totals                                                           |
| `PageDurations` / `PageByteTotals`            | type            | Helper results                                                                                        |
| `getPageDurations(page)`                      | function        | `domContentLoadedMs`, `loadEventMs`, `durationMs`, FP/FCP/LCP, `renderMs` + `renderBasis`, `stableMs` |
| `getPageByteTotals(page)`                     | function        | Document + resource transfer/encoded/decoded totals                                                   |
| `ApiTotals` / `getApiTotals(measurements)`    | type / function | `busyMs` (overlaps counted once) and `spanMs` for a request set                                       |
| `ResponseBytes` / `ResponseByteTotals`        | type            | Declared-size result and rollup shape                                                                 |
| `getResponseBytes(measurement)`               | function        | Declared `Content-Length` for one request                                                             |
| `sumResponseBytes(measurements)`              | function        | Declared-byte sum with measured/unknown counts                                                        |

Page measurement requires a browser (`window`). Outside a browser `monitor.page()` returns
`undefined` and no page report is printed. Byte totals are deliberately labelled **declared**:
`Content-Length` can be absent for chunked/opaque responses and may describe the compressed
size. Resource Timing entries whose sizes are unavailable are counted as unknown instead of
being treated as zero.

Duration helpers return `undefined` for unavailable or invalid pairs — never a fabricated
`0` or a negative value. See [Measurement model](/guide/measurement-model) for timestamp
conventions, lifecycle semantics and examples.

## `TracePulse`

```ts
class TracePulse implements TracePulsePluginApi {
  static readonly version: string
  constructor(options?: TracePulseOptions)

  readonly name: string
  readonly status: TracePulseStatus
  readonly isRunning: boolean
  readonly history: readonly PulseEvent[]
  readonly options: Readonly<ResolvedTracePulseOptions>

  start(): this
  stop(): this
  pulse(name: string, data?: PulseData): PulseEvent | undefined

  on<EventName extends keyof TracePulseEventMap>(
    event: EventName,
    listener: (payload: TracePulseEventMap[EventName]) => void,
  ): Unsubscribe
  once<EventName extends keyof TracePulseEventMap>(
    event: EventName,
    listener: (payload: TracePulseEventMap[EventName]) => void,
  ): Unsubscribe
  off<EventName extends keyof TracePulseEventMap>(
    event: EventName,
    listener: (payload: TracePulseEventMap[EventName]) => void,
  ): void

  use(plugin: TracePulsePlugin): this
  clearHistory(): this
  dispose(): void
}
```

| Member                | Description                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `static version`      | Package version, inlined at build time.                                                                                            |
| `name`                | Resolved instance name (trimmed).                                                                                                  |
| `status`              | `idle` \| `running` \| `stopped` \| `disposed`.                                                                                    |
| `isRunning`           | `true` only while `status === 'running'`.                                                                                          |
| `history`             | Frozen snapshot of recorded pulses, oldest first.                                                                                  |
| `options`             | Frozen, validated options.                                                                                                         |
| `start()`             | Idempotent. No-op when `enabled: false`. Throws after `dispose()`.                                                                 |
| `stop()`              | Idempotent. Throws after `dispose()`.                                                                                              |
| `pulse()`             | Returns the recorded event, or `undefined` when not recorded (not running / sampled out). Throws `INVALID_ARGUMENT` for bad input. |
| `on` / `once` / `off` | Typed subscriptions. `on`/`once` throw after `dispose()`.                                                                          |
| `use()`               | Registers a plugin; returns `this`.                                                                                                |
| `clearHistory()`      | Empties the history buffer.                                                                                                        |
| `dispose()`           | Runs teardowns in reverse order, clears listeners. Idempotent.                                                                     |

## `createTracePulse(options?)`

Convenience factory — identical to `new TracePulse(options)`.

## `TypedEventEmitter<Events>`

A standalone, dependency-free emitter used internally by `TracePulse`.

```ts
class TypedEventEmitter<Events extends object> {
  get listenerCount(): number
  on<E extends keyof Events>(event: E, listener: TypedEventListener<Events[E]>): Unsubscribe
  once<E extends keyof Events>(event: E, listener: TypedEventListener<Events[E]>): Unsubscribe
  off<E extends keyof Events>(event: E, listener: TypedEventListener<Events[E]>): void
  emit<E extends keyof Events>(event: E, payload: Events[E]): void
  listenerCountFor(event: keyof Events): number
  removeAllListeners(event?: keyof Events): void
}
```

## Errors

```ts
class TracePulseError extends Error {
  readonly code: TracePulseErrorCode
  constructor(code: TracePulseErrorCode, message: string, options?: { cause?: unknown })
}

type TracePulseErrorCode = 'INVALID_OPTION' | 'INVALID_ARGUMENT' | 'INVALID_STATE' | 'PLUGIN_ERROR'

function isTracePulseError(value: unknown): value is TracePulseError
function invariant(
  condition: unknown,
  code: TracePulseErrorCode,
  message: string,
): asserts condition
```

## Constants and helpers

| Export              | Description                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `DEFAULT_OPTIONS`   | Frozen resolved defaults (`name`, `enabled`, `sampleRate`, `maxHistory`, `clock`, `idFactory`). |
| `createId(prefix?)` | `crypto.randomUUID()`-based id with a non-crypto fallback.                                      |
| `isRecord(value)`   | `true` for non-null, non-array objects.                                                         |
| `isFunction(value)` | `true` for callables.                                                                           |
| `VERSION`           | Same value as `TracePulse.version`.                                                             |

## Types

| Type                                            | Shape                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `TracePulseOptions`                             | Constructor input: `name?`, `enabled?`, `sampleRate?`, `maxHistory?`, `clock?`, `idFactory?` |
| `Monitor`                                       | Lifecycle (`start`/`stop`), page snapshots and runtime `setThresholds()`                     |
| `ResolvedTracePulseOptions`                     | The same fields, all required and readonly                                                   |
| `PulseEvent`                                    | `{ id, name, timestamp, data? }` (readonly)                                                  |
| `PulseData`                                     | `Readonly<Record<string, unknown>>`                                                          |
| `TracePulseStatus`                              | `'idle' \| 'running' \| 'stopped' \| 'disposed'`                                             |
| `TracePulseEventMap`                            | `start`, `stop`, `pulse`, `error`, `dispose` payloads                                        |
| `TracePulsePlugin`                              | `{ name, setup(api) }`                                                                       |
| `TracePulsePluginApi`                           | Narrow API handed to plugins                                                                 |
| `Clock`, `IdFactory`                            | Injectables                                                                                  |
| `TypedEventListener<Payload>`, `Unsubscribe`    | Emitter helper types                                                                         |
| `TracePulseErrorCode`, `TracePulseErrorOptions` | Error contract                                                                               |

## Package formats

| Format             | File                        | Use                                               |
| ------------------ | --------------------------- | ------------------------------------------------- |
| ESM                | `dist/index.js`             | `import` (tree-shakeable)                         |
| CJS                | `dist/index.cjs`            | `require()`                                       |
| IIFE               | `dist/index.iife.global.js` | `<script>` / CDN, exposes `globalThis.TracePulse` |
| Types (ESM)        | `dist/index.d.ts`           | —                                                 |
| Types (CJS)        | `dist/index.d.cts`          | —                                                 |
| ESM (report)       | `dist/report.js`            | `import '@codewithrajat/tracepulse/report'`       |
| CJS (report)       | `dist/report.cjs`           | `require('@codewithrajat/tracepulse/report')`     |
| Types (report ESM) | `dist/report.d.ts`          | —                                                 |
| Types (report CJS) | `dist/report.d.cts`         | —                                                 |

All bundles are minified; no source maps are shipped. The declaration files are plain
`.d.ts`/`.d.cts` and work with TypeScript 4.7+. The `/report` subpath has no IIFE build: it
is imported, never loaded as a global script.
