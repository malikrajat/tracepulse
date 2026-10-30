# Measurement model

The shared data model for a monitored request: the types plus two small pure helpers that
derive durations. Fetch and XHR instrumentation produce the same `RequestMeasurement` union;
`createMonitor()` installs them and routes terminal measurements to the console reporter.

```ts
import type { RequestMeasurement } from '@codewithrajat/tracepulse'
```

## Timestamps and durations

Every timestamp is a value in milliseconds from **one instrumentation clock**. The default is
`performance.now()`, which is monotonic, so elapsed durations do not jump when the system clock
changes. When `performance` is unavailable, the clock falls back to `Date.now()`; timestamps
from different clocks are never mixed into one measurement.

| Field                 | Required | Meaning                                                           |
| --------------------- | -------- | ----------------------------------------------------------------- |
| `startedAt`           | yes      | When the library began observing the request.                     |
| `queuedAt`            | no       | When the request entered the client-side queue.                   |
| `sentAt`              | no       | When the request was handed to the transport.                     |
| `responseStartedAt`   | no       | When response headers / response-start event became available.    |
| `responseCompletedAt` | no       | When the body finished or the transport completion event fired.   |
| `completedAt`         | no       | When the observed lifecycle ended (completion, failure or abort). |

`queuedAt` and `sentAt` describe dispatch: XHR records `open()` and `send()`; fetch records
the call observation and the moment the native transport accepted the request.

**Unavailable is `undefined`, never `0`.** `0` is a legitimate timestamp, so it must not be
used as a "not measured" sentinel.

Durations are **derived**, never stored a second time. Use the exported helpers:

```ts
import { elapsedMs, getRequestDurations } from '@codewithrajat/tracepulse'

const durations = getRequestDurations(measurement.timing)
durations.queueMs // number | undefined
durations.durationMs // number | undefined
durations.timeToResponseMs // number | undefined
durations.responseBodyMs // number | undefined

elapsedMs(120, 200) // 80
```

| Duration           | Formula                                     | Phase           |
| ------------------ | ------------------------------------------- | --------------- |
| `queueMs`          | `sentAt - queuedAt`                         | Queue           |
| `durationMs`       | `completedAt - (queuedAt ?? startedAt)`     | Observed total  |
| `timeToResponseMs` | `responseStartedAt - (sentAt ?? startedAt)` | Response        |
| `responseBodyMs`   | `responseCompletedAt - responseStartedAt`   | Body (XHR only) |

A duration exists only when both of its timestamps exist. `getRequestDurations()` returns
`undefined` — never a fabricated `0` — when a timestamp is missing, non-finite, or when the
range is inverted (usually a sign that two clocks were mixed). `elapsedMs()` applies the
same rules to any pair of timestamps, for custom measurements.

The returned object always has the same four keys (`queueMs`, `durationMs`,
`timeToResponseMs`, `responseBodyMs`); unavailable values are `undefined`. Destructuring is
therefore always safe. Body time is measured from `responseStartedAt`, never from
`startedAt`, so it excludes the wait for headers; time to response starts at `sentAt` when a
dispatch boundary exists, so it excludes the queue.

This keeps stored timestamps as the single source of truth: a duration can never disagree
with the timestamps it came from.

::: warning fetch and XHR are not symmetric
`fetch()` resolves once headers are available; the body may be consumed much later, and the
library never reads the body just to measure it. `responseCompletedAt` is therefore only set
when completion is observable without consuming the body. XHR exposes a corresponding
completion event, so it can set it in more cases.

For a fetch measurement, `completed` therefore means **"the fetch promise resolved and response
headers are available"** — never "the body was fully consumed" and never "the UI rendered".
`completedAt` equals `responseStartedAt`. `timeToResponseMs` is the whole observed fetch
lifecycle (headers), not full response-download time; `responseBodyMs` stays `undefined`.
`durationMs` is the observed total measured from `queuedAt`, so it includes the short
hand-off before dispatch.
:::

## Lifecycle

```ts
type RequestLifecycleState = 'pending' | 'headers-received' | 'completed' | 'failed' | 'aborted'

type TerminalRequestLifecycleState = 'completed' | 'failed' | 'aborted'
```

| State              | Terminal | Response metadata | Outcome                      | Meaning                                                  |
| ------------------ | -------- | ----------------- | ---------------------------- | -------------------------------------------------------- |
| `pending`          | no       | absent            | absent                       | Started; no response yet.                                |
| `headers-received` | no       | required          | absent                       | Headers available; body may still be arriving.           |
| `completed`        | yes      | required          | `success` \| `http-error`    | The request finished with an HTTP response.              |
| `failed`           | yes      | optional          | `network-error` \| `timeout` | No usable response (unless headers had already arrived). |
| `aborted`          | yes      | optional          | `aborted`                    | Cancelled, possibly after headers.                       |

State and HTTP outcome are deliberately separate. A **404 reaches `completed` with an
`http-error` outcome** — the HTTP exchange succeeded; it is not a network failure.

`failed` may carry `response` when headers had already been received before the failure,
for example a connection reset while streaming the body.

## Outcomes

| `kind`          | Allowed lifecycle | Meaning                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------- |
| `success`       | `completed`       | Response received with a 2xx status.                             |
| `http-error`    | `completed`       | Response received with a non-2xx status (404, 500, 408, 504, …). |
| `network-error` | `failed`          | No usable HTTP response was received; cause not determined.      |
| `timeout`       | `failed`          | A client-side timeout elapsed; no response completed.            |
| `aborted`       | `aborted`         | Cancelled via `AbortController` / XHR `abort`.                   |

A `network-error` keeps only an optional message, never the original error object, so
measurements remain plain, serialisable data.

::: warning `network-error` is a category, not a diagnosis
`network-error` records only that the request ended **without a usable HTTP response**. The
platform does not reliably distinguish DNS, TLS, connection-reset, CORS or URL-parsing failures,
so neither the model nor its consumers may claim a specific cause. A generic rejection from
instrumentation is therefore classified as `network-error` as a **provisional** category; only
`message` may carry the transport's own best-effort text, and it is not authoritative.
:::

## Response metadata

```ts
interface ResponseMetadata {
  status: number // 0 is possible for opaque no-cors responses
  ok: boolean // mirrors Response.ok at capture time
  statusText?: string
  contentType?: string
  contentLength?: number // declared bytes; may be absent or compressed size
}
```

Only metadata is stored. Response bodies, request bodies, cookies, authorization headers
and other sensitive payloads are intentionally excluded.

## Page timing

Page timing is a separate measurement, produced only in a browser:

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

`navigation` comes from Navigation Timing (`getEntriesByType('navigation')`, with the legacy
`performance.timing` object as a rebased fallback). `paints` comes from Paint Timing, LCP from
a buffered `PerformanceObserver`, and `resources` from Resource Timing.

```ts
import { getPageByteTotals, getPageDurations } from '@codewithrajat/tracepulse'

const durations = getPageDurations(page)
durations.domContentLoadedMs // 210
durations.loadEventMs // 1240 — total page load
durations.durationMs // 1240, or capturedAt - startedAt for a soft navigation
durations.firstContentfulPaintMs // 120
durations.largestContentfulPaintMs // 640
durations.renderMs // 640 — LCP, or FCP when LCP was not observed
durations.renderBasis // 'lcp' | 'fcp'
durations.stableMs // 1500 — last activity + page.idleMs quiet window

const bytes = getPageByteTotals(page)
bytes.totalTransferBytes // document + subresources
bytes.unknownResources // entries the browser could not size honestly
```

All page durations are measured from navigation start, so they form one continuous timeline.
Unavailable values stay `undefined`, never `0`.

`stableAt` is recorded by the page instrumentation only when the quiet window was actually
observed: activity windows are the document load and every included Resource Timing entry, and
`stableAt` is the end of the last burst. If capture happened before `page.idleMs` of quiet, the
boundary is absent rather than guessed.

### Aggregate API time

`getApiTotals()` answers "how much time did the page spend in API calls" without double-counting
parallel work:

```ts
import { getApiTotals } from '@codewithrajat/tracepulse'

const totals = getApiTotals(monitor.getReport().measurements)
totals.requests // 12 — measurements considered
totals.measured // 10 — those with a usable start and completion
totals.busyMs // 2100 — overlapping requests counted once
totals.spanMs // 3400 — first start → last completion, idle gaps included
```

The interval is `queuedAt ?? startedAt` → `completedAt`, so a request that never completed is
excluded instead of being estimated.

### Modes and SPA boundaries

- `page.mode: "once"` captures the initial document after `load` + `settleMs`, then disconnects
  the observers.
- `page.mode: "continuous"` keeps observing; `monitor.page()` returns a fresh snapshot and
  `monitor.reportPage()` reports on demand.
- `page.spa: true` (continuous only) starts a `soft-navigation` segment on
  `pushState` / `replaceState` / `popstate` / `hashchange`. The browser reports no Navigation
  Timing entry for a client-side navigation, so a soft-navigation segment has no load or paint
  milestones. Its `durationMs` is the observation window (`capturedAt - startedAt`), which the
  reporter labels **observed** rather than `load`.

TracePulse never guesses whether an application is an SPA. Without `spa: true`, a history
change is not a page boundary.

### Page byte totals

`PageByteTotals` combines the document's Navigation Timing sizes with the Resource Timing
totals. Resource entries whose `transferSize`, `encodedBodySize` and `decodedBodySize` are all
`0` (cross-origin without Timing-Allow-Origin) are counted in `unknownResources` instead of
being silently treated as zero-byte responses. Entries are filtered with the same `exclude`
rules as requests.

## Declared response bytes

The request model exposes the declared `Content-Length` as metadata and two pure helpers:

```ts
import { getResponseBytes, sumResponseBytes } from '@codewithrajat/tracepulse'

getResponseBytes(measurement).declaredBytes // 2048 | undefined
sumResponseBytes(session)
// { declaredBytes: 1458176, measuredResponses: 9, unknownResponses: 3, responses: 12 }
```

This is an honest **declared** total, not a decoded-body measurement:

- `Content-Length` is absent for chunked responses and opaque `no-cors` responses.
- The value may describe the compressed size.
- Fetch and XHR bodies are never read, cloned or buffered to measure them, so a decoded-byte
  count is not obtainable without breaking that guarantee.

`unknownResponses` makes the incompleteness explicit, and the reporter prints `unmeasured`
rather than counting a missing size as `0`.

## UI timing

`uiTiming` is a separate, optional field on completed measurements:

```ts
interface UiTiming {
  updatedAt: number // explicitly marked timestamp on the same clock
}
```

It is absent unless an integration or application code supplies an explicit UI-update
boundary. **Response completion is not render completion**, and the model never pretends
otherwise. When supplied, the render phase is `uiTiming.updatedAt - completedAt`, so it
starts after the observed request lifecycle finished and does not overlap the body interval.

## Examples

### Completed fetch request

```ts
const measurement: RequestMeasurement = {
  id: 'req-1',
  url: 'https://api.example.com/items',
  method: 'GET',
  transport: 'fetch',
  lifecycle: 'completed',
  // fetch completes when headers arrive; the body is neither read nor timed.
  timing: {
    queuedAt: 0,
    startedAt: 0,
    sentAt: 1,
    responseStartedAt: 120,
    completedAt: 120,
  },
  response: { status: 200, ok: true, contentType: 'application/json' },
  outcome: { kind: 'success' },
}
```

### HTTP error is not a network failure

```ts
const notFound: RequestMeasurement = {
  id: 'req-2',
  url: 'https://api.example.com/missing',
  method: 'GET',
  transport: 'fetch',
  lifecycle: 'completed',
  // The response arrived (headers) and is an HTTP error, not a transport failure.
  timing: { queuedAt: 10, startedAt: 10, sentAt: 11, responseStartedAt: 30, completedAt: 30 },
  response: { status: 404, ok: false, statusText: 'Not Found' },
  outcome: { kind: 'http-error' },
}
```

### Pending XHR request

```ts
const pending: RequestMeasurement = {
  id: 'req-3',
  url: 'https://api.example.com/upload',
  method: 'POST',
  transport: 'xhr',
  lifecycle: 'pending',
  timing: { queuedAt: 12, startedAt: 12, sentAt: 12 },
}
```

### Network failure and abort

```ts
const failed: RequestMeasurement = {
  id: 'req-4',
  url: 'https://api.example.com/items',
  method: 'GET',
  transport: 'fetch',
  lifecycle: 'failed',
  timing: { queuedAt: 1, startedAt: 1, sentAt: 2, completedAt: 2 },
  outcome: { kind: 'network-error', message: 'Failed to fetch' },
}

const aborted: RequestMeasurement = {
  id: 'req-5',
  url: 'https://api.example.com/search',
  method: 'GET',
  transport: 'xhr',
  lifecycle: 'aborted',
  timing: { queuedAt: 5, startedAt: 5, sentAt: 5, completedAt: 25 },
  outcome: { kind: 'aborted' },
}
```

XHR does not expose an abort reason, so `AbortedOutcome.reason` is absent for XHR
measurements. `fetch` may include the `AbortError` message when the platform provides one.

## Narrowing

```ts
function describe(measurement: RequestMeasurement): string {
  switch (measurement.lifecycle) {
    case 'pending':
    case 'headers-received':
      return 'in flight'
    case 'completed':
      return `${measurement.response.status} (${measurement.outcome.kind})`
    case 'failed':
      return measurement.outcome.kind
    case 'aborted':
      return 'aborted'
  }
}
```

## Where measurements come from

`createMonitor()` installs the fetch and XHR instrumentation described in the
[API reference](/guide/api#request-monitoring) and routes terminal measurements to the
console reporter. This model module itself stays type-only: the instrumentation, URL
filtering, threshold evaluation and console output all live in internal modules and are
not exposed as public API in V1.
