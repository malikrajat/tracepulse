# Architecture

A complete architectural reference for TracePulse `1.0.0`: the module layout, the runtime
pipeline, every public parameter with its type and default, the validation model, the build
and release machinery, and the licensing structure.

This page is intentionally exhaustive. For a task-oriented introduction start with
[Getting started](/guide/getting-started); for the contract-only view see the
[API reference](/guide/api).

## 1. What TracePulse is

TracePulse is a **browser request diagnostics** library. It instruments the host
application's `fetch()` and `XMLHttpRequest` calls, measures their lifecycle, compares the
durations against configurable warning/critical thresholds, and prints the result to the
developer console.

It is **not**:

- a general profiler or a DevTools replacement (no render tracking, no component tree data);
- a backend, an agent, or a telemetry pipeline — it ships no network code and sends nothing;
- a framework adapter — there is no React, Vue, Angular or Svelte package.

The package also exposes a small generic event/history/plugin primitive (`TracePulse`). In
`1.0.0` that instance is documented as a reference implementation
([README](https://github.com/malikrajat/tracepulse#readme)); the request monitor is the
featured, fully wired subsystem.

### 1.1 At a glance

| Fact                 | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Package              | `@codewithrajat/tracepulse`                                                         |
| Version              | `1.0.0` (documented as unreleased; not resolvable on the public registry yet)       |
| License              | MIT © 2026 Rajat Malik                                                              |
| Runtime dependencies | **none** — `dependencies` is absent and asserted absent by `scripts/check-dist.mjs` |
| Source entry         | `src/index.ts` (the only published entry)                                           |
| Runtime exports      | 20 values + 66 type-only exports                                                    |
| Formats              | ESM, CJS, IIFE + `.d.ts` / `.d.cts`                                                 |
| Size budget          | 13 kB brotli (`size-limit` on `dist/index.js`); README quotes ~12.1 kB              |
| Consumer runtime     | Node 18+, modern browsers, workers, Deno, Bun (target ES2022)                       |
| Development runtime  | Node 22.18+, 24.11+, or 26+ (`.nvmrc` pins 24), pnpm 11                             |
| Consumer TypeScript  | 4.7+ (plain `.d.ts` / `.d.cts`)                                                     |
| Toolchain            | Vite+ (`vp`) — dev, lint, format, type-check, test, pack in one config              |
| Test runner          | Vitest 5, V8 coverage with 90/90/85/90 thresholds                                   |
| Active monitors      | exactly one per loaded module instance                                              |
| Output destination   | the global `console` (no public measurement hook in V1)                             |

## 2. The two subsystems

The package is built from two independent subsystems that share only the options/config
plumbing and the error type.

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ A. Request monitoring pipeline (the featured subsystem)                        │
│                                                                               │
│   app code ──fetch()/XHR──▶ patched globals                                    │
│                               │ RequestMeasurement snapshots (deep-frozen)     │
│                               ▼                                               │
│                    threshold evaluation ──▶ console reporter                  │
│                    (internal)                  (internal)                     │
│                               │                                               │
│                               ▼                                               │
│        console.groupCollapsed + console.table + console.log                   │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│ B. Core pulse instance (generic primitive)                                    │
│                                                                               │
│   createTracePulse(options) ──▶ TracePulse                                    │
│        ├── TypedEventEmitter  (start/stop/pulse/error/dispose)                │
│        ├── bounded history buffer                                             │
│        ├── plugin registry + teardown stack                                   │
│        └── sampled pulse recording                                            │
└───────────────────────────────────────────────────────────────────────────────┘
```

They do **not** call each other. `createMonitor()` never creates a `TracePulse`, and
`TracePulse` never installs instrumentation. This is why the monitor can remain console-only
while the core instance remains framework- and DOM-free.

## 3. Layer map

Every path below is inside `src/`.

| Layer           | Path                                  | Visibility   | Responsibility                                                     |
| --------------- | ------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Public entry    | `index.ts`                            | public       | The single export surface; adding an export is a public-API change |
| Configuration   | `config/config.types.ts`              | public types | `MonitorConfig`, `MonitorConfigInput`, nested input types          |
| Configuration   | `config/config.defaults.ts`           | public       | `DEFAULT_CONFIG`, deeply frozen                                    |
| Configuration   | `config/resolve-config.ts`            | public       | Pure merge + validation orchestration                              |
| Configuration   | `config/validate-config.ts`           | internal     | Runtime validation, path-named `TypeError` / `RangeError`          |
| Core            | `core/trace-pulse.ts`                 | public       | `TracePulse` instance, lifecycle, plugins, history                 |
| Core            | `core/options.ts`                     | public       | `DEFAULT_OPTIONS`, `resolveOptions()`                              |
| Core            | `core/errors.ts`                      | public       | `TracePulseError`, `invariant`, `isTracePulseError`                |
| Core            | `core/types.ts`                       | public       | Instance option/event/plugin types                                 |
| Models          | `models/request-measurement.types.ts` | public       | The measurement union (types only)                                 |
| Models          | `models/request-timing.ts`            | public       | `getRequestDurations()`, `elapsedMs()`                             |
| Models          | `models/page-timing.types.ts`         | public       | Page navigation/paint/resource measurement (types only)            |
| Models          | `models/page-timing.ts`               | public       | `getPageDurations()`, `getPageByteTotals()`, `resolveStableAt()`   |
| Models          | `models/api-totals.ts`                | public       | `getApiTotals()`                                                   |
| Models          | `models/response-bytes.ts`            | public       | `getResponseBytes()`, `sumResponseBytes()`                         |
| Monitor         | `monitor/monitor.ts`                  | public       | `createMonitor()`, `Monitor`, single-active-monitor guard          |
| Instrumentation | `instrumentation/fetch.ts`            | internal     | `globalThis.fetch` wrapper                                         |
| Instrumentation | `instrumentation/xhr.ts`              | internal     | `XMLHttpRequest.prototype` `open`/`send`/`abort` wrappers          |
| Instrumentation | `instrumentation/page.ts`             | internal     | Navigation/Paint/LCP/Resource Timing and SPA boundaries            |
| Instrumentation | `instrumentation/request-id.ts`       | internal     | Shared per-request id generator                                    |
| Thresholds      | `thresholds/*.ts`                     | internal     | `warning`/`critical` classification                                |
| Reporting       | `reporting/console-reporter.ts`       | internal     | Collapsed group + table row + colored summary line                 |
| Utilities       | `utils/emitter.ts`                    | public       | `TypedEventEmitter`                                                |
| Utilities       | `utils/id.ts`                         | public       | `createId()`                                                       |
| Utilities       | `utils/clock.ts`                      | internal     | `performance.now()` with a `Date.now()` fallback                   |
| Utilities       | `utils/url.ts`                        | internal     | Total (never-throwing) URL resolution and exclusion matching       |
| Utilities       | `utils/guards.ts`                     | public       | `isRecord()`, `isFunction()`                                       |
| Version         | `version.ts`                          | public       | `VERSION`, inlined from `package.json` at build time               |

`scripts/check-dist.mjs` enforces this split at release time: it fails the build if
`installFetchInstrumentation`, `installXhrInstrumentation`, `createConsoleReporter`,
`reportMeasurement`, `evaluateThreshold`, `evaluateMeasurementThresholds` or `RequestMonitor`
leak into the ESM build, the CJS build, or the declaration files.

## 4. Request monitoring pipeline

### 4.1 End-to-end flow

```text
createMonitor(input?)
   │
   ├─ resolveConfig(input)                 validate → merge with DEFAULT_CONFIG
   │     └─ throws TypeError / RangeError on invalid input
   │
   ├─ new RequestMonitor(resolvedConfig)   builds the console reporter once
   │     └─ setThresholds(input)            merge + validate into the live config
   │
   └─ if (enabled && autoStart) start()
         │
         ├─ claim the active-monitor token   (else INVALID_STATE)
         ├─ installFetchInstrumentation({ exclude, onMeasurement: reporter })
         ├─ installXhrInstrumentation({ exclude, onMeasurement: reporter })   ← rolls fetch back on failure
         ├─ installPageTimingInstrumentation({ mode, spa, settleMs, idleMs, ... }) ← browser-only, no-op elsewhere
         └─ publish the token + running flag

request happens
   │
   ├─ instrumentation resolves the URL, applies `exclude`
   ├─ emits a `pending` snapshot (frozen)
   └─ emits exactly one terminal snapshot (`completed` | `failed` | `aborted`)

reporter
   │
   ├─ ignores pending / headers-received
   ├─ evaluateMeasurementThresholds(measurement, config.thresholds)
   │     ├─ queueMs          vs queueMs
   │     ├─ timeToResponseMs vs timeToResponseMs
   │     ├─ responseBodyMs   vs responseProcessingMs
   │     └─ uiUpdateMs       vs uiUpdateMs
   ├─ below console.level?             accumulate only, write nothing
   ├─ console.groupCollapsed(header)   one group per request (unless replace)
   │     ├─ console.table([row])       when console.showTable
   │     └─ console.log(summary, css)  session attention summary
   └─ replace: clear + console.table(visible session) + summary
```

### 4.2 Monitor lifecycle matrix

| `enabled` | `autoStart` | Result of `createMonitor()` | `start()`                     |
| --------- | ----------- | --------------------------- | ----------------------------- |
| `true`    | `true`      | Installs instrumentation    | No-op while running           |
| `true`    | `false`     | Idle monitor                | Installs instrumentation      |
| `false`   | `true`      | Idle monitor                | No-op forever for this object |
| `false`   | `false`     | Idle monitor                | No-op forever for this object |

`enabled` is read once while the configuration is resolved. There is no runtime toggle in V1;
a disabled monitor never claims the active slot, so a second, enabled monitor can run
alongside it.

`start()` and `stop()` are idempotent and return `this`. `stop()` never cancels or alters a
request; it only stops observation. A `#stopping` flag prevents a re-entrant `start()` (see section 13) from claiming the slot while
wrappers are being removed.

### 4.3 Installation order and rollback

`RequestMonitor.start()` installs **fetch first**, then XHR, then page timing (when
`page.enabled`).

- fetch installer throws → nothing was installed, the monitor stays idle and can be retried.
- XHR installer throws → the fetch installation is uninstalled first, then the error is
  rethrown.
- Page installer throws → both request transports are uninstalled, then the error is rethrown.
- The active-monitor token and the `#running` flag are published only after all three succeed.

Each request installer is independently single-install: a second call while an installation is
active returns the existing uninstall function and **ignores its own options**. Page
instrumentation is per monitor and is uninstalled by `stop()`.

### 4.4 What each transport observes

| Transport | Observed points                                                                | Emitted snapshots                                                    |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `fetch`   | call time, promise resolution (headers), promise rejection                     | `pending`, then exactly one of `completed` / `failed` / `aborted`    |
| `xhr`     | `open()`, `send()`, `HEADERS_RECEIVED`, `load` / `error` / `timeout` / `abort` | `pending`, optionally `headers-received`, then one terminal snapshot |

Transport-specific behaviour that the architecture guarantees:

| Concern               | `fetch`                                                         | `xhr`                                                         |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| Response body         | never read, never cloned, never `tee`-d                         | never read or buffered                                        |
| `completedAt`         | equals `responseStartedAt` (headers)                            | transport completion event                                    |
| `responseCompletedAt` | never set → `responseBodyMs` is `undefined`                     | set → `responseBodyMs` available                              |
| `responseStartedAt`   | always set on completion                                        | only when `readyState === 2` **and** `status > 0`             |
| `ok`                  | taken from `Response.ok`                                        | derived from the 2xx range                                    |
| status `0`            | opaque `no-cors` response: reported as-is                       | `completed` + `http-error`, `ok: false` — never a success     |
| Abort reason          | `AbortError` name or `signal.aborted`, message kept as `reason` | never populated (XHR exposes no reason)                       |
| Timeout               | `DOMException` named `TimeoutError` → `failed` + `timeout`      | native `timeout` event → `failed` + `timeout`                 |
| Other rejection       | `failed` + `network-error` (category, not a diagnosis)          | `error` event → `failed` + `network-error`                    |
| Promise identity      | a _new_ promise that adopts the original value/rejection        | native XHR object untouched                                   |
| Synchronous XHR       | n/a                                                             | settled from the status readable right after `send()` returns |

The fetch wrapper deliberately returns a **derived** promise rather than attaching a handler
to the original one: attaching a handler would mark an ignored rejection as handled and hide
the application's own unhandled-rejection diagnostics.

### 4.5 Page pipeline

Page measurement is a second, independent pipeline. It does not read request bodies and does
not participate in threshold evaluation for individual requests.

```text
page instrumentation (browser only)
   │
   ├─ Navigation Timing      → startedAt, DOMContentLoaded, load, document bytes
   ├─ Paint Timing           → first-paint, first-contentful-paint
   ├─ PerformanceObserver    → largest-contentful-paint, live resource entries
   ├─ Resource Timing        → transfer / encoded / decoded totals + responseEnd windows
   ├─ activity windows       → stableAt = end of the last burst + idleMs quiet window
   └─ window "load" + settleMs → one PageLoadMeasurement (frozen)
         │
         └─ reporter: PAGE group (navigation, paint, render, stable, api, bytes)

page.mode: "continuous"
   ├─ observers stay installed; monitor.page() returns a fresh snapshot
   ├─ monitor.reportPage() captures and reports on demand
   └─ page.spa: true → history.pushState/replaceState/popstate/hashchange start a
                       "soft-navigation" segment (no browser load/paint milestones)
```

Runtime semantics that the model makes explicit:

| Situation                                       | Result                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| No `window` / no `performance.getEntriesByType` | Page installer is a no-op                                           |
| Document already `complete` at `start()`        | Capture after `settleMs`                                            |
| Document still loading                          | Capture after `window.load` + `settleMs`                            |
| Chunked/opaque request (`fetch`/XHR)            | `contentLength` absent; byte rollups count the response as unknown  |
| Resource Timing entry with all sizes `0`        | Counted as an unknown resource, not a zero-byte response            |
| SPA route change (`page.spa`)                   | New `soft-navigation` segment; duration is the observation window   |
| `page.mode: "once"`                             | Observers disconnect after the capture; `page()` keeps the snapshot |

### 4.6 URL resolution and exclusions

Both transports resolve the request URL with the same total helpers in `utils/url.ts`:

1. `document.baseURI` (honours `<base href>`), else `location.href`, else `undefined`.
2. Relative input resolved against that base with `new URL(raw, base)`.
3. If parsing fails, the original string is preserved; if no URL can be read, `''` is used
   (interpreted as "unknown", never as a request to an empty URL).

Exclusion matching is a **case-sensitive substring** test on the full resolved URL
(query string and fragment included):

```ts
url.includes(rule) // one match is enough
```

Consequences: `/telemetry` also matches `/telemetry-v2`, and a rule containing an origin
matches relative calls to that origin. An empty rule list (the default) monitors everything.
`exclude` is validated to contain only non-empty, non-whitespace strings, precisely because
`''` would match every URL.

## 5. Measurement model and timing

### 5.1 Clocks

| Subsystem               | Default clock                               | Injectable via             |
| ----------------------- | ------------------------------------------- | -------------------------- |
| Request instrumentation | `performance.now()` (fallback `Date.now()`) | internal `now` option only |
| Core `TracePulse`       | `Date.now`                                  | `clock` option             |

Request timestamps come from **one clock function** per measurement and never mix clock
domains. `performance.now()` is monotonic; `Date.now()` is used only as a fallback when
`performance` is unavailable. The core instance clock is wall-clock and is never used for
request durations.

### 5.2 Timestamps

`RequestTiming` uses `undefined` for "not measured" — `0` is a legitimate timestamp and is
never used as a sentinel.

| Field                 | Required | Meaning                                             |
| --------------------- | -------- | --------------------------------------------------- |
| `startedAt`           | yes      | When the library began observing the request        |
| `responseStartedAt`   | no       | Headers (or equivalent response-start event) ready  |
| `responseCompletedAt` | no       | Body consumed / transport completion event          |
| `completedAt`         | no       | End of the observed lifecycle (all terminal states) |

### 5.3 Derived durations

Durations are never stored on a measurement; they are derived by exported pure helpers, so a
duration cannot disagree with the timestamps it came from.

| Duration           | Formula                                     |
| ------------------ | ------------------------------------------- |
| `queueMs`          | `sentAt - queuedAt`                         |
| `durationMs`       | `completedAt - (queuedAt ?? startedAt)`     |
| `timeToResponseMs` | `responseStartedAt - (sentAt ?? startedAt)` |
| `responseBodyMs`   | `responseCompletedAt - responseStartedAt`   |

`elapsedMs(from, to)` returns `undefined` — never `0`, never a negative number — when either
timestamp is missing or non-finite, or when `to < from` (usually a sign that two clocks were
mixed).

### 5.4 Lifecycle and outcome are separate concerns

A 404 is `completed` + `http-error`, not a network failure.

| `lifecycle`        | Terminal? | `response` | Allowed `outcome.kind`       |
| ------------------ | --------- | ---------- | ---------------------------- |
| `pending`          | no        | absent     | —                            |
| `headers-received` | no        | present    | —                            |
| `completed`        | yes       | present    | `success` or `http-error`    |
| `failed`           | yes       | optional   | `network-error` or `timeout` |
| `aborted`          | yes       | optional   | `aborted`                    |

`response` is present on `failed`/`aborted` only when headers had already arrived. The model
deliberately stores no response body, request body, cookies or sensitive headers, and no
`Error` object — only an optional best-effort `message` string.

### 5.5 Snapshot immutability

Instrumentation emits **deep-frozen** snapshots (`Object.freeze` on the measurement, its
`timing`, `response` and `outcome`). A consumer may therefore retain them without copying.
This applies to the internal instrumentation; the `PulseEvent` objects produced by
`TracePulse.pulse()` are _not_ individually frozen (only the `history` array is).

### 5.6 Example snapshot

```ts
const measurement: RequestMeasurement = {
  id: 'req_5f0c…_1',
  url: 'https://api.example.com/items',
  method: 'GET',
  transport: 'fetch',
  lifecycle: 'completed',
  timing: { startedAt: 0, responseStartedAt: 120, completedAt: 120 },
  response: { status: 200, ok: true, contentType: 'application/json' },
  outcome: { kind: 'success' },
}
```

## 6. Threshold evaluation

Threshold evaluation is a pure comparison layer between the measurement and the resolved
configuration. It is **internal** in V1 — nothing in this section is exported.

### 6.1 Metric mapping

Configuration keys are _not_ measurement property names. The mapping is fixed:

| Configuration group    | Measurement metric | Formula                                     |
| ---------------------- | ------------------ | ------------------------------------------- |
| `queueMs`              | `queueMs`          | `sentAt - queuedAt`                         |
| `timeToResponseMs`     | `timeToResponseMs` | `responseStartedAt - (sentAt ?? startedAt)` |
| `responseProcessingMs` | `responseBodyMs`   | `responseCompletedAt - responseStartedAt`   |
| `uiUpdateMs`           | `uiUpdateMs`       | `uiTiming.updatedAt - completedAt`          |

### 6.2 Classification

Boundaries are inclusive at their lower edge:

```text
0 ────────────── warningMs ────────────── criticalMs ──────────▶
     normal       │      warning          │      critical
```

| Status     | Condition                              |
| ---------- | -------------------------------------- |
| `normal`   | `durationMs < warningMs`               |
| `warning`  | `warningMs <= durationMs < criticalMs` |
| `critical` | `durationMs >= criticalMs`             |

`warningMs >= criticalMs` is rejected at configuration time — a zero-width warning band would
make the status ambiguous.

### 6.3 Availability matrix

| Measurement state              | `queueMs`                       | `timeToResponseMs`               | `responseBodyMs`                 | `uiUpdateMs` |
| ------------------------------ | ------------------------------- | -------------------------------- | -------------------------------- | ------------ |
| fetch `completed`              | available (hand-off)            | available = whole observed fetch | unavailable                      | unavailable  |
| fetch `failed`/`aborted`       | when dispatch happened          | only if headers arrived          | unavailable                      | unavailable  |
| XHR `completed`                | available (`open()` → `send()`) | available (`send()` → headers)   | available (headers → completion) | unavailable  |
| XHR `failed`/`aborted`         | when dispatch happened          | only if headers arrived          | only if timestamps exist         | unavailable  |
| `pending` / `headers-received` | when dispatch happened          | only if headers arrived          | unavailable                      | unavailable  |

An unavailable metric is returned as `{ status: 'unavailable', reason: 'missing' }` or
`{ status: 'unavailable', reason: 'invalid-duration' }`. It is never dropped, zero-filled,
inferred from another timing, or reported as `normal`.

`uiUpdateMs` is unavailable for **every** measurement the current instrumentation produces:
neither transport sets `uiTiming`, and V1 exposes no API through which an application could
supply it. The setting is forward-looking configuration, not an active measurement.

### 6.4 Invalid data versus invalid configuration

| Input                           | Result                                        |
| ------------------------------- | --------------------------------------------- |
| `undefined` duration            | `unavailable` / `missing`                     |
| negative or non-finite duration | `unavailable` / `invalid-duration` (no throw) |
| non-number threshold            | `TypeError`                                   |
| negative / non-finite threshold | `RangeError`                                  |
| `warningMs >= criticalMs`       | `RangeError`                                  |

The rule: invalid _data_ is an expected runtime outcome; invalid _thresholds_ are a
programming error.

## 7. Console reporting

The reporter is a plain callback with the same signature as the instrumentation's
`onMeasurement` sink, so no second instrumentation layer exists.

### 7.1 Report contents

Only terminal snapshots are reported. `pending` and `headers-received` are ignored. The
stateful reporter keeps every terminal request. By default each report appends one collapsed
group whose header stays visible and whose contents hold the single request row plus the
session summary; the growing session is never reprinted. `reportMeasurement()` renders one
group for a single measurement.

`console.replace: true` is the alternative mode: the reporter clears the console and redraws
the complete accumulated table, so the newest table lists the whole session under one
header. It takes precedence over `collapsible` and clears host application output.

`console.panel: true` moves the same session out of the console. Browser DevTools cannot
remove or update a single entry, so a live table there can only reprint or clear. The panel
appends one shadow-root overlay to the document, keeps it collapsed by default, and replaces
its contents in place after every report: one row per request occurrence, the session
summary and the page report. The console is not written to at all. The panel takes
precedence over `replace` and `collapsible`; without a DOM the reporter falls back to the
console modes.

Table row (in insertion order):

| Key                | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `Method`           | upper-cased HTTP method                                          |
| `URL`              | resolved URL                                                     |
| `Transport`        | `fetch` or `xhr`                                                 |
| `Status`           | HTTP status, or `unavailable` / `unavailable (status 0)`         |
| `Lifecycle`        | `completed`, `failed` or `aborted`                               |
| `Outcome`          | `success`, `http-error`, `network-error`, `timeout` or `aborted` |
| `Bytes`            | declared `Content-Length`, or `unavailable`                      |
| `Queue`            | `queueMs` evaluation                                             |
| `Time to response` | `timeToResponseMs` evaluation                                    |
| `Response body`    | `responseBodyMs` evaluation                                      |
| `UI render`        | `uiUpdateMs` evaluation                                          |
| `ID`               | request id                                                       |

The four timing columns are independent classifications of one continuous timeline;
no column duplicates another.

The collapsed group header shows the request status, endpoint, HTTP/outcome text and worst
measured phase, then appends `↑ <phase> +<delta>` for each phase that became slower than the
previous sample of the same endpoint. Normal increases use the warning colour; warning and
critical increases use their own colours. This keeps regressions visible without expanding
the group.

### 7.2 Summary block

```text
TracePulse [CRITICAL] · 4 requests · 3 endpoints
  care now      GET api.example.com/report — 1 request · HTTP 500 (http-error), Time to response 5020 ms (critical)
  concern       POST api.example.com/checkout — 2 requests · 2 warnings · Time to response 1240 ms (warning)
  watch         GET api.example.com/items — 1 request · close to warning: Time to response 120 ms of 150 ms
```

- Requests are grouped by endpoint (method + path, ignoring query/hash), so page-load and
  interaction-triggered calls to the same API share one line.
- Whole-session status = the **worst** of the four phases across every request
  (`unavailable` < `normal` < `warning` < `critical`), escalated for failures, aborts and
  HTTP errors.
- Buckets: `care now` (critical/5xx/failure), `concern` (warning/4xx/abort), `watch`
  (normal but within 20% of a warning boundary), `not improving` (later samples at least
  25% and 10 ms slower than the first half), and `healthy`.
- Buckets and their rows are ordered worst-first. Inside a bucket, more critical requests rank
  first, then more warnings, then the highest HTTP error, then the largest threshold overshoot.
  `watch` ranks by proximity to the warning boundary and `not improving` by the steepest
  regression.
- A near-limit phase (within 20% of its warning boundary) is marked
  `near limit: <phase> <duration> of <boundary>` in the derived elevated colour in the
  always-visible header, alongside any breach in another phase.
- Unavailable metrics are formatted `unavailable` or `unavailable (invalid)`, never `0`.
- Durations are rounded for display only: integers verbatim, otherwise one decimal.
- The summary header appends the session's **declared** `Content-Length` total, and a `data`
  bucket shows the largest endpoints by declared bytes. Responses without a trustworthy
  `Content-Length` are reported as `unmeasured`, not counted as zero.
- Colors use CSS `%c` formatting. Each summary row is coloured by its own severity rather than
  the whole block inheriting the session colour: `care now` is the critical colour, `concern`
  is the warning colour, `watch` and `not improving` use a derived elevated colour halfway
  between the configured normal and warning colours, and `healthy` is the normal colour. The
  derived colour keeps an early or degrading state visible without overstating it as a breach,
  and adds no public configuration. Data and unmeasured rows are neutral, and `unavailable` is
  never colored, so it cannot look like a healthy measurement.

### 7.3 Page report

A page measurement is printed as its own collapsed group, independent of the per-request
groups:

```text
TracePulse [PAGE · NORMAL] · https://app.example.com/dashboard · 1.24 s load · LCP 640 ms
  navigation   navigate · DOMContentLoaded 210 ms · load 1.24 s (normal)
  paint        first paint 90 ms · FCP 120 ms (normal) · LCP 640 ms (normal)
  bytes        document 18.4 kB · resources 1.4 MB across 42 requests · total 1.42 MB transferred
  requests     12 requests · 980 kB declared
```

- Page load, FCP and LCP are classified against `page.thresholds`; the worst status colours
  the header and sets the `PAGE · <STATUS>` label.
- `page.mode: "continuous"` + `page.spa: true` reports each history boundary with
  `soft-navigation` and `observed`, never with a fabricated `load` duration.
- Byte totals combine Navigation Timing (document) and Resource Timing (subresources).
  Entries whose sizes are unavailable are counted as `without sizes`; they are not
  silently treated as zero.
- Declared request bytes use decimal units (`kB`, `MB`, `GB`) and are labelled `declared`,
  because `Content-Length` can be absent or describe a compressed body.

### 7.4 Isolation

Reporting is diagnostic, not part of request execution. The reporter never mutates its
inputs, never throws, and isolates: a throwing `console`, a throwing table formatter and a
failing evaluation all degrade to silence rather than changing a request's outcome.

## 8. Core pulse instance

`TracePulse` is the generic primitive exported alongside the monitor.

### 8.1 Lifecycle

```text
idle ──start()──▶ running ──stop()──▶ stopped
  ▲                  │                   │
  └───── start() ────┘                   │
                     └── start() ────────┘

dispose() ──▶ disposed (terminal)
```

| Status     | Meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `idle`     | Created, not recording (also the permanent state with `enabled: false`) |
| `running`  | `pulse()` records and emits                                             |
| `stopped`  | Paused; `pulse()` is a no-op until `start()`                            |
| `disposed` | Terminal. Listeners cleared, plugin teardowns executed                  |

After `dispose()`, every mutating method throws `INVALID_STATE`; only `off()`, `dispose()`
and the read-only accessors remain safe.

### 8.2 Events

| Event     | Payload         | When                                          |
| --------- | --------------- | --------------------------------------------- |
| `start`   | `{ timestamp }` | Status becomes `running`                      |
| `stop`    | `{ timestamp }` | Status becomes `stopped`                      |
| `pulse`   | `PulseEvent`    | A pulse is recorded                           |
| `error`   | `Error`         | A plugin teardown threw during `dispose()`    |
| `dispose` | `{ timestamp }` | Disposal starts, before listeners are cleared |

Dispatch is synchronous, in subscription order, over a snapshot of the listener set. A
throwing listener aborts the remaining listeners and propagates to the caller — intentional,
so failures are never silent.

### 8.3 Plugins

A plugin is `{ name, setup(api) }`. `setup()` receives a deliberately narrow
`TracePulsePluginApi` (`name`, `status`, `history`, `pulse`, `on`) and may return a teardown
function.

- Plugin names are unique per instance (`INVALID_ARGUMENT` on duplicates).
- If `setup()` throws, registration is rolled back and a `PLUGIN_ERROR` is thrown with the
  original error as `cause`.
- Teardowns run in reverse registration order. A teardown failure emits on `error` and does
  not stop the remaining teardowns.

## 9. Parameter reference

Every public parameter, its type, whether it is required, and its default. "Input" names the
exact property path accepted by the API.

### 9.1 `createMonitor(input?)` — `MonitorConfigInput`

`input` is optional; omitting it is identical to `{}` and therefore to all defaults.

| Input (path)                                 | Type                       | Required | Default       | Validation                                                          |
| -------------------------------------------- | -------------------------- | -------- | ------------- | ------------------------------------------------------------------- |
| `enabled`                                    | `boolean`                  | no       | `true`        | must be boolean; `null` is rejected                                 |
| `autoStart`                                  | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `exclude`                                    | `readonly string[]`        | no       | `[]`          | array of non-empty, non-whitespace strings; replaced, not merged    |
| `page`                                       | `PageConfigInput`          | no       | see 9.5       | plain object                                                        |
| `page.enabled`                               | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `page.mode`                                  | `"once" \| "continuous"`   | no       | `"once"`      | exact union                                                         |
| `page.spa`                                   | `boolean`                  | no       | `false`       | must be boolean                                                     |
| `page.settleMs`                              | `number`                   | no       | `300`         | finite, `>= 0`                                                      |
| `page.resources`                             | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `page.idleMs`                                | `number`                   | no       | `300`         | finite, `>= 0`                                                      |
| `page.thresholds`                            | `PageThresholdConfigInput` | no       | see 9.5       | plain object                                                        |
| `page.thresholds.pageLoadMs`                 | `DurationThresholdInput`   | no       | `{3000,5000}` | pair                                                                |
| `page.thresholds.firstContentfulPaintMs`     | `DurationThresholdInput`   | no       | `{1800,3000}` | pair                                                                |
| `page.thresholds.largestContentfulPaintMs`   | `DurationThresholdInput`   | no       | `{2500,4000}` | pair                                                                |
| `page.thresholds.pageStableMs`               | `DurationThresholdInput`   | no       | `{4000,8000}` | pair                                                                |
| `thresholds`                                 | `ThresholdConfigInput`     | no       | see 9.2       | plain object; unknown keys ignored at every level                   |
| `thresholds.queueMs`                         | `DurationThresholdInput`   | no       | `{100,300}`   | plain object                                                        |
| `thresholds.queueMs.warningMs`               | `number`                   | no       | `100`         | finite, `>= 0`                                                      |
| `thresholds.queueMs.criticalMs`              | `number`                   | no       | `300`         | finite, `>= 0`, strictly `> warningMs` (after merge)                |
| `thresholds.timeToResponseMs`                | `DurationThresholdInput`   | no       | `{2000,3000}` | plain object                                                        |
| `thresholds.timeToResponseMs.warningMs`      | `number`                   | no       | `2000`        | finite, `>= 0`                                                      |
| `thresholds.timeToResponseMs.criticalMs`     | `number`                   | no       | `3000`        | finite, `>= 0`, strictly `> warningMs` (after merge)                |
| `thresholds.responseProcessingMs`            | `DurationThresholdInput`   | no       | `{300,500}`   | plain object                                                        |
| `thresholds.responseProcessingMs.warningMs`  | `number`                   | no       | `300`         | finite, `>= 0`                                                      |
| `thresholds.responseProcessingMs.criticalMs` | `number`                   | no       | `500`         | finite, `>= 0`, strictly `> warningMs` (after merge)                |
| `thresholds.uiUpdateMs`                      | `DurationThresholdInput`   | no       | `{500,1000}`  | plain object                                                        |
| `thresholds.uiUpdateMs.warningMs`            | `number`                   | no       | `500`         | finite, `>= 0`                                                      |
| `thresholds.uiUpdateMs.criticalMs`           | `number`                   | no       | `1000`        | finite, `>= 0`, strictly `> warningMs` (after merge)                |
| `colors`                                     | `ColorConfigInput`         | no       | see 9.3       | plain object                                                        |
| `colors.normal`                              | `string`                   | no       | `#22c55e`     | hex only: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`                   |
| `colors.warning`                             | `string`                   | no       | `#eab308`     | hex only                                                            |
| `colors.critical`                            | `string`                   | no       | `#ef4444`     | hex only                                                            |
| `console`                                    | `ConsoleConfigInput`       | no       | see 9.4       | plain object                                                        |
| `console.enabled`                            | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `console.level`                              | `ConsoleLevel`             | no       | `all`         | `all`, `warning`, `critical` or `off`; default from `__LOG_LEVEL__` |
| `console.useColors`                          | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `console.showTable`                          | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `console.collapsible`                        | `boolean`                  | no       | `true`        | must be boolean                                                     |
| `console.replace`                            | `boolean`                  | no       | `false`       | must be boolean                                                     |
| `console.panel`                              | `boolean`                  | no       | `false`       | must be boolean                                                     |

Two behaviours worth stating explicitly:

- `exclude` is **replaced wholesale**, never concatenated with the default.
- `null` is **not** treated as "not provided" for monitor configuration: `enabled: null`
  throws `TypeError`. Only `undefined` (and an absent key) falls back to the default.

### 9.2 Threshold groups — semantics

Each group is an explicit `{ warningMs, criticalMs }` pair. There is **no formula** deriving
one boundary from the other, and the old single-number shape is rejected rather than
reinterpreted.

| Group                  | Measures                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `queueMs`              | Wait before dispatch: XHR `open()` → `send()`, fetch call → native acceptance.                                            |
| `timeToResponseMs`     | Dispatch → response headers. For fetch this is the whole observed lifecycle, not full download.                           |
| `responseProcessingMs` | The headers → transport-completion interval where measurable. **Not** application processing time. Unavailable for fetch. |
| `uiUpdateMs`           | Observed completion → an explicitly supplied UI-update point. Unavailable from both transports in V1.                     |

Boundaries are inclusive at the lower edge and validated **after merging**, so a partial
override cannot silently cross a default boundary:

```ts
resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000 } } })
// RangeError: config.thresholds.timeToResponseMs.warningMs must be less than
// config.thresholds.timeToResponseMs.criticalMs, received 3000 and 3000
```

### 9.3 Colors

Independent of thresholds: thresholds decide _which_ status applies, colors decide _how_ it
is rendered. Values are stored exactly as supplied (case and shorthand are preserved); the
group header and summary are colored, never individual table cells.

| Input      | Default   | Meaning                       |
| ---------- | --------- | ----------------------------- |
| `normal`   | `#22c55e` | within thresholds             |
| `warning`  | `#eab308` | at or above the warning edge  |
| `critical` | `#ef4444` | at or above the critical edge |

### 9.4 Console preferences

| Input         | Default | Effect when `false` / non-default value                     |
| ------------- | ------- | ----------------------------------------------------------- |
| `enabled`     | `true`  | Reporter becomes a no-op; no console method is ever called  |
| `useColors`   | `true`  | Header and summary are written as plain text                |
| `showTable`   | `true`  | No `console.table` row; the summary is still written        |
| `collapsible` | `true`  | Plain header line instead of a collapsed console group      |
| `replace`     | `false` | Default grouped output; `true` clears and redraws one table |
| `panel`       | `false` | Console output; `true` renders one collapsed in-page panel  |
| `level`       | `"all"` | Minimum severity; `"off"` disables output entirely          |

### 9.5 Page configuration and modes

| Input                                      | Default        | Meaning                                                    |
| ------------------------------------------ | -------------- | ---------------------------------------------------------- |
| `page.enabled`                             | `true`         | Measure and report the page in browser-like runtimes       |
| `page.mode`                                | `"once"`       | Bounded capture at load, or `"continuous"` observation     |
| `page.spa`                                 | `false`        | Treat history changes as page boundaries (continuous only) |
| `page.settleMs`                            | `300`          | Wait after `load` for late resources/LCP before capturing  |
| `page.resources`                           | `true`         | Include Resource Timing totals                             |
| `page.idleMs`                              | `300`          | Quiet window that confirms the stability boundary          |
| `page.thresholds.pageLoadMs`               | `{3000, 5000}` | Total navigation → `load`                                  |
| `page.thresholds.firstContentfulPaintMs`   | `{1800, 3000}` | Navigation → FCP                                           |
| `page.thresholds.largestContentfulPaintMs` | `{2500, 4000}` | Navigation → LCP observed at capture                       |
| `page.thresholds.pageStableMs`             | `{4000, 8000}` | Navigation → stable (last activity + quiet window)         |

Mode semantics are deliberately explicit:

- **`once`** — the non-SPA page model. Capture the initial document once, then disconnect the
  observers. `monitor.page()` keeps returning the captured measurement after `stop()`.
- **`continuous`** — the long-lived model. Observers stay installed; `monitor.page()` returns
  a fresh snapshot and `monitor.reportPage()` captures/reports on demand.
- **`spa: true`** — only with `continuous`. `pushState`, `replaceState`, `popstate` and
  `hashchange` start a `soft-navigation` segment. The browser reports no Navigation Timing
  entry for a client-side route change, so such a segment has no load/paint milestones and
  its printed duration is the observation window (`observed`), never a fabricated `load`.
- **No guessing.** TracePulse never infers SPA behaviour from the framework, URL shape or
  timing. If `spa` is false, history changes are not page boundaries.

Page measurement is skipped entirely outside a browser (no `window`), so starting a monitor
in Node/SSR does not create timers or print page reports.

### 9.6 `createTracePulse(options?)` / `new TracePulse(options?)`

`TracePulseOptions` is a separate input type from the monitor configuration.

| Input        | Type           | Required | Default                          | Validation                               |
| ------------ | -------------- | -------- | -------------------------------- | ---------------------------------------- |
| `name`       | `string`       | no       | `"tracepulse"`                   | non-empty after `trim()`; stored trimmed |
| `enabled`    | `boolean`      | no       | `true`                           | must be boolean                          |
| `sampleRate` | `number`       | no       | `1`                              | finite, `0 <= x <= 1`                    |
| `maxHistory` | `number`       | no       | `50`                             | integer, `>= 0` (`0` disables storage)   |
| `clock`      | `() => number` | no       | `Date.now`                       | must be a function                       |
| `idFactory`  | `() => string` | no       | `() => createId()` → `tp_<uuid>` | must be a function                       |

Invalid input throws `TracePulseError` with code `INVALID_OPTION` (not `TypeError`/
`RangeError` — the two configuration systems intentionally have distinct error contracts).

> **Asymmetry:** this resolver uses `??`, so `null` behaves like "not provided"
> (`new TracePulse({ name: null })` resolves to `"tracepulse"`), whereas the monitor
> configuration rejects `null`. TypeScript callers cannot hit this; plain-JavaScript callers
> can.

### 9.7 Runtime method parameters

| Call                                    | Parameters                                    | Returns                              | Throws                                                                                                            |
| --------------------------------------- | --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `createMonitor(input?)`                 | `MonitorConfigInput` (optional)               | `Monitor`                            | `TypeError` / `RangeError` (config), `TracePulseError` `INVALID_STATE` (auto-start conflict), `Error` (installer) |
| `monitor.start()`                       | —                                             | `this`                               | `TracePulseError` `INVALID_STATE`                                                                                 |
| `monitor.stop()`                        | —                                             | `this`                               | never                                                                                                             |
| `monitor.page()`                        | —                                             | `PageLoadMeasurement` or `undefined` | never                                                                                                             |
| `monitor.reportPage()`                  | —                                             | `this`                               | never                                                                                                             |
| `monitor.setThresholds(input)`          | `ThresholdConfigInput`                        | `this`                               | `TypeError` / `RangeError`; the active thresholds are left unchanged                                              |
| `createTracePulse(options?)`            | `TracePulseOptions` (optional)                | `TracePulse`                         | `TracePulseError` `INVALID_OPTION`                                                                                |
| `pulse.pulse(name, data?)`              | `name: string` (required), `data?: PulseData` | `PulseEvent` or `undefined`          | `INVALID_ARGUMENT`, `INVALID_STATE`                                                                               |
| `pulse.on(event, listener)`             | event name, listener                          | `Unsubscribe`                        | `INVALID_STATE` after dispose                                                                                     |
| `pulse.once(event, listener)`           | event name, listener                          | `Unsubscribe`                        | `INVALID_STATE` after dispose                                                                                     |
| `pulse.off(event, listener)`            | event name, listener                          | `void`                               | never                                                                                                             |
| `pulse.use(plugin)`                     | `TracePulsePlugin`                            | `this`                               | `INVALID_ARGUMENT`, `PLUGIN_ERROR`, `INVALID_STATE`                                                               |
| `pulse.clearHistory()`                  | —                                             | `this`                               | `INVALID_STATE` after dispose                                                                                     |
| `pulse.dispose()`                       | —                                             | `void`                               | never (teardown errors go to `error`)                                                                             |
| `resolveConfig(input?)`                 | `MonitorConfigInput` (optional)               | `MonitorConfig`                      | `TypeError` / `RangeError`                                                                                        |
| `getRequestDurations(timing)`           | `RequestTiming` (required)                    | `RequestDurations`                   | never                                                                                                             |
| `getPageDurations(page)`                | `PageLoadMeasurement` (required)              | `PageDurations`                      | never                                                                                                             |
| `getPageByteTotals(page)`               | `PageLoadMeasurement` (required)              | `PageByteTotals`                     | never                                                                                                             |
| `getApiTotals(measurements)`            | `readonly RequestMeasurement[]`               | `ApiTotals`                          | never                                                                                                             |
| `getResponseBytes(measurement)`         | `RequestMeasurement` (required)               | `ResponseBytes`                      | never                                                                                                             |
| `sumResponseBytes(measurements)`        | `readonly RequestMeasurement[]`               | `ResponseByteTotals`                 | never                                                                                                             |
| `elapsedMs(from?, to?)`                 | two optional timestamps                       | `number` or `undefined`              | never                                                                                                             |
| `createId(prefix?)`                     | `prefix = 'tp'`                               | `string`                             | never                                                                                                             |
| `invariant(condition, code, message)`   | `unknown`, `TracePulseErrorCode`, `string`    | `void` (asserts)                     | `TracePulseError` when falsy                                                                                      |
| `isRecord(value)` / `isFunction(value)` | `unknown`                                     | `boolean` guard                      | never                                                                                                             |

`pulse()` argument rules:

- `name` must be a non-empty string after trimming; it is stored trimmed.
- `data` must be a plain object (`isRecord`): arrays, `null`, functions and primitives are
  rejected.
- It returns `undefined` — without throwing — whenever the instance is not running, disabled,
  or the pulse is sampled out.
- With `maxHistory: 0` the event is **still emitted and returned**; it is simply not stored.

### 9.8 Internal parameters (not public API)

Documented because they define the pipeline's contracts; none are re-exported.

| Function                        | Parameters                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `installFetchInstrumentation`   | `{ exclude?: readonly string[]; onMeasurement?: (m) => void; now?: Clock; idFactory?: IdFactory }` |
| `installXhrInstrumentation`     | same shape                                                                                         |
| `createConsoleReporter`         | `config: MonitorConfig`                                                                            |
| `reportMeasurement`             | `measurement`, `config`, optional pre-computed `thresholdResults`                                  |
| `evaluateMeasurementThresholds` | `measurement: RequestMeasurement`, `thresholds: ThresholdConfig`                                   |
| `evaluateThreshold`             | `durationMs` (or `undefined`), `warningThresholdMs`, `criticalThresholdMs`                         |
| `resolveOptions`                | `TracePulseOptions`                                                                                |
| `TracePulseError` constructor   | `(code, message, { cause?: unknown })`                                                             |

## 10. Defaults, merging and precedence

### 10.1 Precedence ladder

```text
call-site argument  >  resolved configuration  >  DEFAULT_CONFIG / DEFAULT_OPTIONS
```

`resolveConfig()` and `resolveOptions()` are the only places defaults are applied. Nothing
downstream re-reads `DEFAULT_CONFIG`, so a resolved object is always complete.

### 10.2 Resolution algorithm (`resolveConfig`)

1. `validateConfigInput(input)` — validate the raw object before touching defaults.
   Unknown keys at any nesting level are ignored; known keys are validated strictly.
2. Build `thresholds` leaf-by-leaf: `input?.group?.boundary ?? defaults.group.boundary`.
   Each boundary merges **independently**.
3. `validateResolvedThresholds(thresholds)` — re-check the merged pairs, because a valid
   partial override can still cross the default boundary.
4. Build `colors` and `console` per property with `??`.
5. Build `enabled` / `autoStart` with `??`, and copy `exclude` into a fresh array.
6. Return a **new, unfrozen** `MonitorConfig`.

`undefined` means "not provided". Because the merge uses `??`, falsy-but-valid values such as
`0` and `false` are honoured: `{ warningMs: 0 }` overrides the default with `0`.

### 10.3 Merge behaviour matrix

| Input shape                                                 | Behaviour                                     |
| ----------------------------------------------------------- | --------------------------------------------- |
| `{ thresholds: { timeToResponseMs: { warningMs: 1500 } } }` | `criticalMs` keeps its default `3000`         |
| `{ colors: { normal: '#0f0' } }`                            | other two colors keep their defaults          |
| `{ console: { showTable: false } }`                         | other two console flags keep their defaults   |
| `{ exclude: ['/a'] }`                                       | replaces the default `[]`; never concatenated |
| `{ exclude: [] }`                                           | explicitly resets to "monitor everything"     |
| `{ thresholds: undefined }`                                 | entire group falls back to defaults           |
| `{ unknownKey: 1 }`                                         | ignored (forward compatibility)               |
| `{ enabled: null }`                                         | `TypeError` — `null` is not "not provided"    |

No formula converts the pre-release single-number threshold shape, and the old
`requestDurationMs` key is rejected rather than ignored:

- `{ requestDurationMs: 3000 }` throws `TypeError: config.thresholds.requestDurationMs is no
  longer supported; use config.thresholds.timeToResponseMs with { warningMs, criticalMs }`.
- `{ timeToResponseMs: 2000 }` throws `TypeError: … must be a plain object, received 2000`.

See [Threshold pairs](/guide/migration).

### 10.4 Immutability guarantees

| Object                       | Frozen?         | Notes                                                              |
| ---------------------------- | --------------- | ------------------------------------------------------------------ |
| `DEFAULT_CONFIG`             | yes, **deeply** | every nested object and the `exclude` array are frozen             |
| `DEFAULT_OPTIONS`            | yes, shallow    | contains only primitives and two functions                         |
| Result of `resolveConfig()`  | no              | a fresh object that shares no mutable state with defaults or input |
| `pulse.options`              | yes             | `Object.freeze` in `resolveOptions()`                              |
| `pulse.history`              | yes (array)     | frozen copy; the `PulseEvent` objects inside are not frozen        |
| Emitted `RequestMeasurement` | yes, **deeply** | measurement, `timing`, `response`, `outcome`                       |
| Emitted `PulseEvent`         | no              | plain object handed to listeners and stored in history             |

"Shares no mutable state" is enforced structurally: `exclude` is always a new array, and every
nested group is rebuilt rather than referenced.

### 10.5 Worked example

```ts
import { resolveConfig } from '@codewithrajat/tracepulse'

const config = resolveConfig({
  exclude: ['/telemetry'],
  thresholds: { timeToResponseMs: { warningMs: 1500 } },
  console: { showTable: false },
})

config.exclude // ['/telemetry']
config.thresholds.timeToResponseMs.warningMs // 1500
config.thresholds.timeToResponseMs.criticalMs // 3000 (default preserved)
config.thresholds.responseProcessingMs.criticalMs // 500 (default)
config.colors.normal // '#22c55e' (default)
config.console.showTable // false
config.console.useColors // true (default)
```

## 11. Validation architecture

Two distinct error contracts coexist by design.

| Layer                            | Error type                 | Codes                                                                 | Rationale                                                                            |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Monitor configuration            | `TypeError` / `RangeError` | —                                                                     | `resolveConfig()` is a plain-data API; platform error types are the least surprising |
| Core options / arguments / state | `TracePulseError`          | `INVALID_OPTION`, `INVALID_ARGUMENT`, `INVALID_STATE`, `PLUGIN_ERROR` | One catchable class with stable, machine-readable codes                              |

### 11.1 `TypeError` versus `RangeError`

- **`TypeError`** — wrong type, wrong shape, or an unsupported string format (non-hex color,
  non-string exclusion, non-boolean flag).
- **`RangeError`** — a number outside its domain (`NaN`, `±Infinity`, negative durations) or a
  merged pair violating `warningMs < criticalMs`.

### 11.2 Path-named messages

Every configuration message names the offending path, which is what makes failures
actionable without reading the source:

```text
config.thresholds.timeToResponseMs.warningMs must be greater than or equal to 0, received -1
config.colors.normal must be a hex color (#rgb, #rgba, #rrggbb or #rrggbbaa), received "green"
config.exclude[1] must be a non-empty string
config.thresholds.timeToResponseMs must be a plain object, received 2000
```

### 11.3 `TracePulseError` shape

```ts
class TracePulseError extends Error {
  readonly code: 'INVALID_OPTION' | 'INVALID_ARGUMENT' | 'INVALID_STATE' | 'PLUGIN_ERROR'
  constructor(code: TracePulseErrorCode, message: string, options?: { cause?: unknown })
}
```

`name` is set to `'TracePulseError'`; `cause` is forwarded through the standard `Error` options
only when provided. `invariant(condition, code, message)` is the exported assertion helper and
narrows types for TypeScript callers.

### 11.4 Validation is fail-fast and non-coercive

Invalid input never produces a valid-looking result. There is no coercion, no clamping, no
warning-and-continue. In the monitor configuration, `undefined` is the only value treated as
"not provided" (`null` is a type error); unknown keys are the only input silently ignored.

## 12. Error and failure containment map

The library's central invariant: **monitoring must never change the application's request or
result**. Every place that could violate it is wrapped.

| Location                               | Failure swallowed? | Why                                                  |
| -------------------------------------- | ------------------ | ---------------------------------------------------- |
| `onMeasurement` listener throws        | yes                | A monitoring consumer must not affect the request    |
| Console API throws (group/table/log)   | yes                | Reporting is diagnostic                              |
| Threshold evaluation throws mid-report | yes                | Reporter stays silent rather than inventing a status |
| Clock or metadata read throws          | yes                | Best-effort metadata                                 |
| `fetch` wrapper internals throw        | yes                | The application receives its untouched promise       |
| XHR listener attachment fails          | rolled back        | Request proceeds untracked                           |
| XHR wrapper install fails              | rolled back        | Native methods restored                              |
| Uninstall throws                       | yes                | Cleanup must not break the caller                    |
| Plugin teardown throws                 | emitted on `error` | One bad plugin must not block the others             |
| Business errors (config, arguments)    | **no**             | Invalid usage must be loud and early                 |

## 13. Concurrency, isolation and failure containment

### 13.1 One monitor per loaded module instance

```ts
let activeMonitor: symbol | undefined // module-scoped, not global
```

The guard lives in the loaded module instance. Consequences:

- Two different `Monitor` objects cannot both run; the second `start()` throws
  `TracePulseError` with code `INVALID_STATE`.
- Two copies of the package in one bundle (different module instances) **are not coordinated**
  and can each start a monitor — and then both wrap `fetch`, double-reporting.
- Separate realms (iframe, worker) are likewise independent.

### 13.2 Single-install instrumentation

Both installers keep their own module-level `activeInstallation`. While one is active, a second
call returns the existing uninstall function and **ignores its own options** — options are not
merged.

### 13.3 In-flight requests

| Action                | Effect                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| `monitor.stop()`      | No cancellation, no change to results. Terminal snapshots stop.                  |
| fetch in flight       | Original promise settles normally; the terminal handler checks `isActive`        |
| XHR in flight         | Listeners detached; late events produce no snapshot                              |
| Snapshot already sent | Remains delivered (immutable history)                                            |
| `start()` again       | Observes only requests made after it; old in-flight requests are not re-reported |

No `stop`/`abort` lifecycle event is synthesized, and no terminal snapshot is invented for an
abandoned observation.

### 13.4 Third-party patches

Uninstall restores a global only if TracePulse's own wrapper is still installed. If another
library wrapped `fetch` (or an XHR prototype method) afterwards, that patch is preserved and
TracePulse simply stops recording. A later `start()` wraps the **current** function, so each
request is reported at most once.

### 13.5 Environments without the APIs

If `fetch` is absent (older Node, exotic runtime) the fetch installer returns a no-op uninstall.
If `XMLHttpRequest` or any of `open`/`send`/`abort` is absent, the XHR installer does the same.
Installing on the server therefore fails soft rather than throwing — but patching global
`fetch` in an SSR process is still a per-process side effect, so prefer creating the monitor
only in a browser.

## 14. Framework integration surface

There is no framework code anywhere in `src/`. Integration means owning the lifecycle.

### 14.1 React

```tsx
// src/telemetry/TracePulseProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

const Ctx = createContext<TracePulse | null>(null)

export function TracePulseProvider({ children }: { children: ReactNode }) {
  const [pulse, setPulse] = useState<TracePulse | null>(null)

  useEffect(() => {
    const instance = createTracePulse({ name: 'react-app' })
    instance.start()
    setPulse(instance)

    return () => {
      setPulse(null)
      instance.dispose()
    }
  }, [])

  return <Ctx.Provider value={pulse}>{children}</Ctx.Provider>
}

export const useTracePulse = () => useContext(Ctx)
```

**Do not** create the instance with `useMemo` and dispose it in an effect cleanup, which is
what the README recipe currently shows. React StrictMode runs setup → cleanup → setup on the
same memoized instance, `dispose()` is terminal, and the second `start()` throws
`INVALID_STATE`. Creating the instance _inside_ the effect gives each mount its own instance.

The monitor is safer: `stop()`/`start()` on the **same** monitor are idempotent, so a
module-level `createMonitor()` survives StrictMode. Only one may run per module instance.

Skip `createMonitor()` in React Server Components and on the server: it patches the
process-wide `fetch`.

### 14.2 Angular

```ts
// trace-pulse.service.ts
import { DestroyRef, Injectable, inject, PLATFORM_ID } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { createMonitor, type Monitor } from '@codewithrajat/tracepulse'

@Injectable({ providedIn: 'root' })
export class TracePulseService {
  private readonly monitor: Monitor | null = null

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return

    this.monitor = createMonitor({
      exclude: ['/telemetry'],
      thresholds: { timeToResponseMs: { warningMs: 1000, criticalMs: 2000 } },
    })
    inject(DestroyRef).onDestroy(() => this.monitor?.stop())
  }
}
```

Keep the service `providedIn: 'root'`. A component-scoped copy creates a second monitor, which
throws `INVALID_STATE` while the root one runs. Zones are irrelevant here: the monitor does not
touch change detection, so zoneless and zone-based applications behave identically — and
consequently nothing about Angular rendering is measured.

### 14.3 Vanilla

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({ exclude: ['/telemetry'] })
// ... application runs ...
monitor.stop()
```

## 15. Build and distribution architecture

### 15.1 One config file

`vite.config.ts` drives `vp dev`, `vp check`, `vp test`, `vp pack` and the pre-commit hook.
There is no ESLint, Prettier, Vitest or tsdown config file.

Key build settings:

| Setting           | Value                                                  | Effect                                      |
| ----------------- | ------------------------------------------------------ | ------------------------------------------- |
| `pack.entry`      | `{ index: src/index.ts, report: src/report/index.ts }` | Root entry + opt-in `/report` entry         |
| `pack.format`     | `esm`, `cjs`, `iife` (root); `esm`, `cjs` (report)     | Four bundles per build                      |
| `pack.globalName` | `TracePulse`                                           | IIFE global (root only)                     |
| `pack.define`     | `__VERSION__` = `package.json` version                 | `VERSION` becomes a literal, tree-shakeable |
| `pack.dts`        | `true`                                                 | `index.*` and `report.*` declarations       |
| `pack.sourcemap`  | `false`                                                | Smaller tarball, cleaner `dist/`            |
| `pack.minify`     | `true`                                                 | Minified but still statically exported      |
| `pack.target`     | `es2022`                                               | Matches the documented runtime              |
| `pack.platform`   | `neutral`                                              | No Node/browser assumptions baked in        |
| `pack.treeshake`  | `true`                                                 | Unused modules dropped                      |

The report build runs as a second `pack` config with `clean: false`, so it cannot remove the
root artifacts. It has no IIFE: the subpath is imported, never loaded as a global script.

`resolve.alias` maps both specifiers to source for `vp dev` and `vp test` (the more specific
`@codewithrajat/tracepulse/report` first), so the playground and tests exercise the public
entries without a build step.

### 15.2 Published formats

| Format             | File                        | Consumer                                      |
| ------------------ | --------------------------- | --------------------------------------------- |
| ESM                | `dist/index.js`             | `import`, tree-shaken                         |
| CJS                | `dist/index.cjs`            | `require()`                                   |
| IIFE               | `dist/index.iife.global.js` | `<script>` / CDN → `globalThis.TracePulse`    |
| Types (ESM)        | `dist/index.d.ts`           | TypeScript 4.7+                               |
| Types (CJS)        | `dist/index.d.cts`          | `require()` consumers                         |
| ESM (report)       | `dist/report.js`            | `import '@codewithrajat/tracepulse/report'`   |
| CJS (report)       | `dist/report.cjs`           | `require('@codewithrajat/tracepulse/report')` |
| Types (report ESM) | `dist/report.d.ts`          | TypeScript 4.7+                               |
| Types (report CJS) | `dist/report.d.cts`         | `require()` consumers                         |

### 15.3 Export map

```json
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" },
    "default": "./dist/index.js"
  },
  "./report": {
    "import": { "types": "./dist/report.d.ts", "default": "./dist/report.js" },
    "require": { "types": "./dist/report.d.cts", "default": "./dist/report.cjs" },
    "default": "./dist/report.js"
  },
  "./package.json": "./package.json"
}
```

`main`, `module`, `types`, `unpkg` and `jsdelivr` mirror the root entry. `"type": "module"`
means every `.d.ts` is interpreted as ESM, which is exactly why CJS-flavoured `.d.cts` files
exist; `attw` enforces both entries. There are no arbitrary deep imports: the package exposes
the root entry, one opt-in `/report` subpath and `package.json`. The subpath is separate so a
consumer that never exports a report does not pay for the renderer, and the release check
asserts the renderer names are absent from the root bundle.

### 15.4 Why no source maps

A deliberate trade-off: smaller tarball and a predictable `dist/`. Builds are reproducible from
source, and the declaration files retain full JSDoc for editor hints. Flip `pack.sourcemap`
if debuggable output is ever needed.

### 15.5 Tree-shaking

`sideEffects: false` plus static ESM exports means a consumer importing only
`createTracePulse` drops the monitor, instrumentation and reporter. Importing anything has no
top-level side effects; the id fallback is guarded by `typeof`.

### 15.6 TypeScript posture

`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax` and
`isolatedModules`. Emit is disabled: declarations come from `vp pack`.

Published types avoid syntax newer than TypeScript 4.7, even though development runs on
TypeScript 7. `skipLibCheck` is on, as is `esModuleInterop`.

### 15.7 Package metadata contract

`scripts/check-dist.mjs` asserts, among other things:

- all five artifacts exist;
- `type: "module"` and `sideEffects: false` are preserved;
- `main`/`module`/`types` and both `exports` conditions match exactly;
- `files` includes `dist`;
- **`dependencies` is absent** (the zero-runtime-dependency promise is machine-checked);
- no internal export leaks into ESM, CJS or either declaration file;
- the IIFE bundle exposes `TracePulse`;
- `createMonitor` and `Monitor.start/stop` are declared in both `.d.ts` files.

## 16. Quality and verification architecture

### 16.1 Test layout

| Directory                | Focus                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `tests/unit/`            | Instance lifecycle, options, errors, emitter, utils, version |
| `tests/config/`          | Resolution, validation, public configuration surface         |
| `tests/instrumentation/` | fetch wrapper, XHR wrapper, request identity, URL rules      |
| `tests/monitor/`         | `createMonitor` lifecycle and public surface                 |
| `tests/reporting/`       | Console output, colors, table shape                          |
| `tests/thresholds/`      | Boundary classification and measurement evaluation           |
| `tests/models/`          | Duration derivation                                          |
| `tests/integration/`     | Public-entry workflows                                       |
| `tests/types/`           | Compile-time API tests (`*.test-d.ts`)                       |

Specs import from `vite-plus/test`, not `vitest`, so one copy of the runner is shared with
`vp test`.

### 16.2 Coverage gates

V8 coverage with per-metric thresholds — lines 90, functions 90, branches 85, statements 90.
Type-only modules and re-export barrels are excluded because they contain no behaviour.

### 16.3 CI pipeline

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`, on Node 22 and 24:

1. `pnpm exec vp check` — format, type-aware lint, type-check.
2. `pnpm exec vp test run --coverage`.
3. `pnpm exec vp pack`.
4. `pnpm run check:package` (Node 24 only) — dist assertions, `publint --strict`,
   `attw --pack . --profile node16`, `size-limit`.
5. `pnpm run test:browser` with `TRACEPULSE_REQUIRE_BROWSER=1` — real Chromium smoke test.
6. Coverage artifact upload.

`pnpm verify` runs the same gate locally plus the browser test.

### 16.4 Release pipeline

`.github/workflows/release.yml` uses `changesets/action` on every push to `main`:

- if unreleased changesets exist → opens/updates a **Version Packages** PR;
- if the version PR was merged → runs `pnpm run release` (`vp pack` then
  `changeset publish`).

Permissions: `contents: write`, `pull-requests: write`, and `id-token: write` for npm
provenance. `NPM_CONFIG_PROVENANCE=true` and `NPM_TOKEN` are provided as environment/secrets.
`prepublishOnly` re-runs `vp pack`, so a stale `dist/` can never be published.

## 17. Licensing architecture

### 17.1 Identity

| Item                   | Value                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| License                | MIT                                                                                                                          |
| SPDX identifier        | `MIT`                                                                                                                        |
| Copyright holder       | Rajat Malik                                                                                                                  |
| Copyright year         | 2026                                                                                                                         |
| `package.json#license` | `MIT`                                                                                                                        |
| License file           | [`LICENSE`](https://github.com/malikrajat/tracepulse/blob/main/LICENSE) (repository root, included in the published tarball) |
| Docs site footer       | “Released under the MIT License.” © 2026 Rajat Malik                                                                         |
| README badge           | `license: MIT`                                                                                                               |

The MIT license is **permissive and non-copyleft**: it does not require derivative works to be
relicensed under MIT, but it does require attribution to be preserved.

### 17.2 What the license grants, requires and disclaims

| Dimension    | MIT terms (summary of the license text)                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Grants       | Permission to use, copy, modify, merge, publish, distribute, sublicense and sell copies of the software                |
| Conditions   | The copyright notice and this permission notice must be included in all copies or substantial portions of the software |
| Warranty     | Provided **“AS IS”**, without warranty of any kind                                                                     |
| Liability    | Authors/holders are not liable for claims, damages or other liability                                                  |
| Patent grant | none (MIT grants no express patent license)                                                                            |
| Trademark    | none (MIT grants no trademark or naming rights)                                                                        |

Practical consequences for a consumer:

- You may use it commercially, in closed-source products, with or without modification.
- You must keep the copyright + permission notice when you redistribute the software or a
  substantial portion of it. This applies to vendored copies and to a bundled `node_modules`
  tree that ships to customers.
- You may not hold the author liable, and you receive no warranty.
- You may not use “TracePulse” or the project logo to imply endorsement. Fork names must not
  be presented as the official package.

### 17.3 What ships in the tarball

`package.json#files` limits the published artifact to:

```json
["dist", "README.md", "LICENSE", "CHANGELOG.md"]
```

So the license travels with the code in every distribution channel (npm, and any CDN mirror
that proxies the npm tarball). Nothing else — tests, scripts, docs sources, the playground and
the toolchain — is published.

### 17.4 Dependency licensing

| Category                 | Status                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime `dependencies`   | **none** — `dependencies` is absent and asserted absent at release time                                                                                                                   |
| Bundled third-party code | **none** — the bundles contain only project code plus the inlined version string                                                                                                          |
| `peerDependencies`       | none                                                                                                                                                                                      |
| Build/dev dependencies   | `vite-plus`, `@vitest/coverage-v8`, `typescript`, `vitepress`, `publint`, `@arethetypeswrong/cli`, `size-limit`, `@changesets/cli`, `@types/node` — build-time only, never in the tarball |

Because no third-party code is bundled and no runtime dependency is declared, consumers inherit
**no transitive license obligations** from TracePulse. The dev-dependency licenses govern only
contributors building the project, not users of the published package.

Two honest caveats:

- There is **no automated license audit** in the pipeline (no `license-checker`, no
  `licensee`, no SBOM generation step), so the zero-obligation claim rests on the
  `dependencies`-absent assertion, not on a scan.
- The bundles carry **no license banner**. Attribution is satisfied by the `LICENSE` file in
  the tarball plus the `license` field in `package.json`, which is the conventional MIT
  practice for a package distributed through npm. If you re-bundle TracePulse into a single
  artifact of your own, you should add the notice yourself.

### 17.5 Distribution channels and their license posture

| Channel                     | Artifact                    | License handling                     |
| --------------------------- | --------------------------- | ------------------------------------ |
| npm (`npm publish`)         | tarball with `LICENSE`      | `license: MIT` + file in tarball     |
| unpkg (`unpkg` field)       | `dist/index.iife.global.js` | Served from the npm tarball          |
| jsDelivr (`jsdelivr` field) | `dist/index.iife.global.js` | Served from the npm tarball          |
| GitHub repository           | full source + `LICENSE`     | MIT at the repository root           |
| GitHub Pages docs           | built VitePress site        | Footer states MIT © 2026 Rajat Malik |

### 17.6 Inbound licensing for contributions

- There is **no CLA and no DCO requirement** in the repository; `CONTRIBUTING.md` asks only for
  tests, a passing `pnpm verify`, documentation and a changeset.
- The repository `LICENSE` is the only license instrument, so the project’s licensing model is
  “inbound contributions land under the repository license” by convention rather than by a
  signed agreement. If the project ever needs explicit provenance for contributions, that is a
  policy gap to close deliberately (see section 20).
- Commit conventions (Conventional Commits, allowed types) and the changeset requirement are
  documented in `CONTRIBUTING.md`.

### 17.7 Supply-chain posture

| Control               | State                                                        |
| --------------------- | ------------------------------------------------------------ |
| npm provenance (OIDC) | enabled — `id-token: write`, `NPM_CONFIG_PROVENANCE=true`    |
| Publish token         | granular `NPM_TOKEN` secret with access to `@codewithrajat`  |
| Public access         | `publishConfig.access: public` + changesets `access: public` |
| Pre-publish rebuild   | `prepublishOnly: vp pack`                                    |
| Lockfile in CI        | `pnpm install --frozen-lockfile`                             |
| Dependency updates    | `.github/dependabot.yml`                                     |
| Signed releases/SBOM  | not configured                                               |
| License/SBOM scanning | not configured                                               |

### 17.8 Versioning and release architecture

- [Changesets](https://github.com/changesets/changesets) drives versions and `CHANGELOG.md`;
  every user-facing change requires a changeset.
- From `1.0.0` onward **strict SemVer** applies: breaking public API changes are `major`.
- `.changeset/config.json`: `access: "public"`, `baseBranch: "main"`,
  `updateInternalDependencies: "patch"`, no fixed/linked groups.
- Merging the auto-generated **Version Packages** PR publishes to npm with provenance and
  creates the GitHub release.
- `VERSION` is a build-time `define` literal taken from `package.json`, so it cannot drift
  from the published version; unbuilt source (tests, the playground) reports
  `0.0.0-dev` instead of throwing.

## 18. Extension points

Extend outward; there are no internal hooks to patch in V1. Runnable versions of these patterns
live in [`examples/`](https://github.com/malikrajat/tracepulse/tree/main/examples).

| Need                              | Pattern                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Different output destination      | Wrap `console.groupCollapsed`/`console.table`/`console.log`, or re-implement `Monitor`             |
| Extra measurements                | Build objects conforming to the public `RequestMeasurement` model and call `getRequestDurations()` |
| Custom thresholds per environment | Call `resolveConfig()` yourself and pass the result to your own monitor wrapper                    |
| App-level instrumentation         | Use `TracePulse` + plugins for the application’s own events                                        |
| Framework integration             | Lifecycle wrappers as in section 14                                                                |
| Filtering beyond substring rules  | Pre-process `exclude` (regex/glob → substring list)                                                |

## 19. Non-goals and V1 limitations

The explicit per-protocol decisions — what is in scope, what is deliberately excluded, and what is
still open — live in [Scope and protocol decisions](/guide/scope).

- No public raw-measurement API, reporter factory or threshold evaluator.
- No **per-request** UI/render timing; `uiTiming` still has no producer. Page-level paint
  and LCP are measured by the separate page instrumentation.
- No network transport, storage, request sampling, or backend.
- No soft-navigation detection by guesswork: SPA boundaries are opt-in (`page.spa`) and
  derived from history events, never inferred from timing or URL shape.
- No multiple simultaneous monitors per module instance.
- No deduplication between fetch and XHR.
- No instrumenting `fetch` references captured **before** installation.
- No retroactive measurement of requests started before `start()`.
- No automatic browser-support matrix file; runtime requirement is “ES2022”.
- No source maps in the published package.

## 20. Known limitations

These are deliberate V1 limits rather than documentation defects. Rely on the code and the
tests where this guide is ambiguous.

| #   | Limitation                                            | Consequence                                                                                      | Workaround                                          |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | `uiUpdateMs` has no live measurement source           | No transport populates `uiTiming`, and V1 exposes no public input.                               | Treat the setting as prepared, not active           |
| 2   | History is a shallow frozen array                     | The array is frozen; the `PulseEvent` objects inside are not deep-frozen.                        | Don’t mutate retained events                        |
| 3   | `resolveConfig()` returns a fresh **unfrozen** object | Only `DEFAULT_CONFIG` is frozen; callers can mutate their own copy without corrupting defaults.  | Freeze the result yourself if you share it          |
| 4   | Package is not published yet                          | `registry.npmjs.org/@codewithrajat/tracepulse` returns 404; the README calls `1.0.0` unreleased. | Install with `file:`/workspace link until published |

## Appendix A — Complete default reference

```json
{
  "monitor": {
    "enabled": true,
    "autoStart": true,
    "exclude": [],
    "thresholds": {
      "queueMs": { "warningMs": 100, "criticalMs": 300 },
      "timeToResponseMs": { "warningMs": 2000, "criticalMs": 3000 },
      "responseProcessingMs": { "warningMs": 300, "criticalMs": 500 },
      "uiUpdateMs": { "warningMs": 500, "criticalMs": 1000 }
    },
    "colors": { "normal": "#22c55e", "warning": "#eab308", "critical": "#ef4444" },
    "console": {
      "enabled": true,
      "level": "all",
      "useColors": true,
      "showTable": true,
      "collapsible": true,
      "replace": false,
      "panel": false
    }
  },
  "instance": {
    "name": "tracepulse",
    "enabled": true,
    "sampleRate": 1,
    "maxHistory": 50,
    "clock": "Date.now",
    "idFactory": "createId() → tp_<uuid>"
  }
}
```

## Appendix B — Runtime export surface

| Export                | Kind     | Notes                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------- |
| `createMonitor`       | function | `(input?) => Monitor`                                                         |
| `resolveConfig`       | function | `(input?) => MonitorConfig`                                                   |
| `DEFAULT_CONFIG`      | const    | deeply frozen                                                                 |
| `createTracePulse`    | function | `(options?) => TracePulse`                                                    |
| `TracePulse`          | class    | generic instance; `static version`                                            |
| `DEFAULT_OPTIONS`     | const    | frozen resolved instance defaults                                             |
| `TracePulseError`     | class    | `code`, `cause`, `name`                                                       |
| `isTracePulseError`   | function | `instanceof` narrowing; check `code`/`name` across realms or copies           |
| `invariant`           | function | assertion helper; narrows types                                               |
| `TypedEventEmitter`   | class    | standalone typed emitter                                                      |
| `getRequestDurations` | function | derives `queueMs` / `durationMs` / `timeToResponseMs` / `responseBodyMs`      |
| `getPageDurations`    | function | derives `domContentLoadedMs` / `loadEventMs` / paint, `renderMs`, `stableMs`  |
| `getPageByteTotals`   | function | document + Resource Timing byte rollup                                        |
| `getApiTotals`        | function | busy (overlaps once) and span network time for a request set                  |
| `getResponseBytes`    | function | declared `Content-Length` for one request                                     |
| `sumResponseBytes`    | function | declared-byte total with measured/unknown counts                              |
| `elapsedMs`           | function | difference between two same-clock timestamps                                  |
| `createId`            | function | `createId(prefix = 'tp')`                                                     |
| `isRecord`            | function | plain-object guard                                                            |
| `isFunction`          | function | callable guard                                                                |
| `VERSION`             | const    | build-time literal, mirrors `TracePulse.version`; `0.0.0-dev` outside a build |

Everything else — installers, reporter, threshold evaluator, monitor class, URL and clock
helpers — is internal and verified absent from the published artifacts.

## Appendix C — Glossary

| Term              | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| Measurement       | One immutable `RequestMeasurement` snapshot emitted by instrumentation   |
| Terminal snapshot | `completed`, `failed` or `aborted` — no further updates for that request |
| Pulse             | A recorded application event (`PulseEvent`) from the core instance       |
| Threshold pair    | An explicit `{ warningMs, criticalMs }` pair per metric                  |
| Exclusion rule    | A case-sensitive URL substring that suppresses monitoring                |
| Realm             | A JavaScript global environment (window, worker, iframe)                 |
| Provenance        | npm’s signed attestation tying a published tarball to its source commit  |
| Changeset         | A Markdown file declaring an intended semver bump and its description    |

## Next steps

- [Configuration](/guide/configuration) — the configuration contract with examples.
- [Measurement model](/guide/measurement-model) — timestamp and lifecycle semantics.
- [API](/guide/api) — every export and signature.
- [Publishing](/guide/publishing) — releasing `1.0.0` and everything after it.
- [Troubleshooting](/guide/troubleshooting) — common failures and their causes.
