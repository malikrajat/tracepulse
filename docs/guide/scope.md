# Scope and protocol decisions

This page is the explicit scope contract. It states which protocols produce measurements, which
are deliberately excluded, what each captured pattern actually looks like, and which questions
are still open.

If a transport or pattern is not listed here, do not infer support from silence. Silence is not a
decision.

**At a glance:** TracePulse measures HTTP request/response lifecycles initiated through
`fetch()` and `XMLHttpRequest`, plus a separate browser page-load measurement. Everything else
is either captured only because it travels through those two APIs, or deliberately out of scope.

## 1. Decision table

| Surface                                                     | Status                           | What TracePulse does                                                                                                                                           | Why                                                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch()`                                                   | **In scope**                     | Replaces `globalThis.fetch`; emits `pending`, then exactly one of `completed` / `failed` / `aborted`. Completion means response headers are available.         | It has a request, a response, an HTTP status and a terminal outcome.                                                                                                                |
| `XMLHttpRequest`                                            | **In scope**                     | Patches `open`, `send`, `abort`; emits `pending`, optionally `headers-received`, then one terminal snapshot.                                                   | Same request/response boundary, with a body-completion event fetch does not expose.                                                                                                 |
| Short polling                                               | **Captured, with caveats**       | Every poll is an independent request with its own id, lifecycle and terminal report. The summary groups polls by method + path, but does not model one stream. | Polling is not a transport; it is repeated use of an in-scope transport. See [section 3](#3-polling-precisely).                                                                     |
| Long polling                                                | **Captured, with caveats**       | One slow request. Where the hold appears depends on the transport, and an intentional cancel is reported as an abort.                                          | Same reason, plus fetch/XHR differ in what they can observe. See [section 3](#3-polling-precisely).                                                                                 |
| `EventSource` / SSE                                         | **Deliberately excluded**        | Untouched. Produces no `RequestMeasurement`, no threshold row and no console report.                                                                           | It is a long-lived event stream: no HTTP completion, no request/response pair, and the lifecycle model has no terminal stream state.                                                |
| `WebSocket`                                                 | **Deliberately excluded**        | Untouched.                                                                                                                                                     | There is no HTTP status/headers/completion boundary and no request/response pair. `RequestMeasurement.lifecycle` and `.outcome` cannot describe a duplex channel or its close code. |
| WebRTC (`RTCPeerConnection`, data channels)                 | **Deliberately excluded**        | Untouched.                                                                                                                                                     | There is no HTTP request/response boundary at all.                                                                                                                                  |
| `navigator.sendBeacon()`                                    | **Deliberately excluded**        | Untouched.                                                                                                                                                     | Fire-and-forget: the page receives no response, so there is no terminal outcome to record.                                                                                          |
| Browser resource loads (`img`, `script`, `link`, font, CSS) | **Page-only**                    | Not request rows. Their Resource Timing entries contribute to the page byte totals when `page.resources` is enabled.                                           | The browser initiates them; there is no application call site to instrument and no per-request row in the model.                                                                    |
| Document navigation                                         | **Page-only, separate pipeline** | A `PageLoadMeasurement` with Navigation, Paint and Resource Timing; classified by `page.thresholds`.                                                           | It is not an HTTP request row, and it uses its own thresholds (`pageLoadMs`, FCP, LCP).                                                                                             |
| Node `http` / `https` / `undici` clients                    | **Deliberately excluded**        | Only global `fetch` is patched. Other HTTP clients are not.                                                                                                    | The public scope is the platform `fetch`/XHR surface, not every HTTP implementation in a runtime.                                                                                   |

## 2. What "in scope" guarantees

For every in-scope request, instrumentation guarantees:

- a unique `id` and the resolved `method`, `url` and `transport`;
- exactly one terminal snapshot (`completed`, `failed` or `aborted`);
- deep-frozen snapshots that can be retained without copying;
- the application's original result, rejection identity and timing are unchanged;
- response metadata is best-effort and never invented: status `0` is not a success, and an absent
  duration is `undefined`, never `0`;
- response bodies are never read, cloned or buffered, so body bytes are not measured.

The last point is a scope boundary, not an implementation detail. It determines what "bytes" and
"download time" can honestly mean in this library.

## 3. Polling, precisely

Polling is not modelled as a workload. It is observed as the requests it produces.

### Short polling

Each poll is an ordinary in-scope request:

- **N polls = N measurements**, each with a new id and one terminal snapshot.
- **N console groups** by default: one collapsed group per terminal report. `console.level` can
  hide healthy ones; `console.replace: true` redraws one accumulated table instead, and
  `console.panel: true` renders one collapsed in-page table updated in place (no console
  entries at all).
- **Unbounded session growth**: the reporter keeps every terminal entry for the monitor's
  lifetime. There is no retention cap and no monitor-level sampling.
- **No logical-stream grouping**: the summary groups rows by method + path with query and hash
  stripped (`endpointKey`), so polls to the same endpoint share one summary line and one "previous
  sample". They are still N rows in the table and N events in the console.
- **Sampling does not exist here**: `sampleRate` belongs to `createTracePulse()`, not to
  `createMonitor()`.
- **Trend logic is not poll-aware**: `trendOf()` compares the first half of an endpoint's samples
  with the second half, using a 25% and 10 ms guard. A real latency drift across a long polling
  session can therefore surface as `not improving`, even when nothing regressed.

### Long polling

A long poll is one request whose response is deliberately delayed:

- **`fetch`**: the observed lifecycle ends when headers arrive. If the server withholds headers,
  that wait appears in `timeToResponseMs` and can be `critical` by design. If headers arrive early
  and the body is held open, `fetch` looks fast and `responseBodyMs` is unavailable, because the
  body is never read.
- **XHR**: `responseStartedAt` is captured at `HEADERS_RECEIVED` and `responseCompletedAt` at
  `load`. A hold after headers therefore appears in `responseBodyMs`; a hold before headers
  appears in `timeToResponseMs`.
- **Cancellation**: an intentional long-poll cancel is `lifecycle: 'aborted'`. The reporter
  escalates any abort to at least `warning` (the `concern` bucket), because it cannot distinguish
  intent. There is no "expected cancel" configuration.
- **Timeouts**: `AbortSignal.timeout()` and the native XHR timeout are `failed` + `timeout`, which
  is `critical` because it indicates the request did not complete as configured.

Current mitigations are `exclude` for the endpoint, or endpoint-specific thresholds. Neither
changes the underlying classification: a long poll is still one slow request.

## 4. What "page fully loaded" means today

A page measurement exists, but it is tied to browser load, not application quiescence.

- **`page.mode: "once"` (default)**: capture after the window `load` event plus `page.settleMs`
  (default `300` ms), then disconnect the observers. If the document is already `complete` when
  the monitor starts, capture after the same settle delay.
- **`page.mode: "continuous"`**: observers stay installed; `monitor.page()` returns a fresh
  snapshot and `monitor.reportPage()` captures and reports on demand.
- **`page.spa: true`** (continuous only): `pushState`, `replaceState`, `popstate` and `hashchange`
  start a `soft-navigation` segment with an observed duration, never a fabricated `load`.

What the page report contains: navigation type, DOMContentLoaded and load durations, render
(LCP, or FCP when LCP was not observed), FCP/LCP, the observed stability boundary, document and
Resource Timing byte totals, and request time + byte rollups.

What exists as a bounded observation (not a general quiescence engine):

- an observed stability boundary: `stableAt` is the end of the last activity burst, published
  only when a `page.idleMs` quiet window was seen before capture;
- `getApiTotals()`, which counts overlapping requests once (`busyMs`) and reports the wall-clock
  span (`spanMs`).

What does **not** exist:

- no in-flight request tracking, so a request still running at capture has no Resource Timing
  entry and the snapshot can look stable before it settles;
- no "all requests settled" promise beyond that observation window;
- no polling or streaming awareness;
- no session end beyond `stop()` or an explicit `reportPage()`.

Consequences for the patterns on this page:

- A polling app produces request reports forever after the page report; the page report describes
  the browser load, not application readiness.
- A streaming app may keep one request open past the page report. `fetch` still terminates at
  headers; XHR terminates when the stream closes.
- For such apps, "fully loaded" is genuinely undefined. That is an open decision below, not an
  implicit claim.

## 5. Total time and bytes

Two different rollups exist, and they must not be conflated.

### Per request: declared bytes

- `response.contentLength` is the parsed `Content-Length`, when it is a plain non-negative safe
  integer.
- `getResponseBytes()` returns it for one measurement; `sumResponseBytes()` totals a session.
- The reporter shows it in the table `Bytes` column, the summary header and the `data` bucket.
- Responses without a trustworthy value are counted as unmeasured, never as zero.
- It can describe the **compressed** size, is absent for chunked responses, and is available on
  both fetch and XHR.

This is not a body measurement. The library never reads the body to obtain one.

### Per page: measured transfer totals

- `getPageByteTotals()` combines Navigation Timing (document) and Resource Timing (subresources).
- It exposes `totalTransferBytes`, `totalEncodedBodyBytes` and `totalDecodedBodyBytes` when the
  browser reports them.
- `unknownResources` counts entries whose sizes were unavailable or all zero (for example
  cross-origin without Timing-Allow-Origin), so a total is not presented as complete when it is
  not.
- This includes resources the request monitor never sees (`img`, `script`, CSS, fonts), because it
  is browser Resource Timing data, not request instrumentation.
- It inherits the same `exclude` rules.

So "total downloaded bytes" exists at page level as measured transfer, and decoded totals exist
for resources that expose them. At request level the only available figure is declared
`Content-Length`. WebSocket, SSE and WebRTC contribute nothing to either rollup.

## 6. Open decisions

These are unresolved. Each needs an explicit choice before implementation; none has a current
default that can be inferred from behaviour.

### Decision 1 — Is polling a first-class workload?

**Today:** every poll is a separate request row, a separate console group and an unbounded session
entry.

**Decision needed:** choose one direction.

- keep polling as repeated requests (current behaviour);
- add monitor-level sampling so a poll interval does not produce every report;
- add a logical-stream key so N polls become one row/stream while retaining per-request data;
- add poll-aware classification so expected cadence and drift are not treated as regressions.

**Constraint:** sampling and logical grouping change delta/trend computation, which currently
relies on every sample being present. They are not reporter-only changes.

### Decision 2 — How should "page fully loaded" be defined?

**Today:** browser `load` + `settleMs` for capture, plus a bounded stability observation
(`stableAt` + `page.idleMs`), or an explicit `reportPage()`.

**Options:**

- **explicit application signal**: the app marks readiness; no heuristic, no guessing;
- **network-idle heuristic**: no request started or settled for N ms, with in-flight tracking;
- **load-only**: keep the browser load boundary and state that it is not application readiness;
- **never**: leave the definition entirely to the application.

**Why it is still open:** a polling app may never be idle, and a streaming app may never settle. A
heuristic that works for one is wrong for the other. TracePulse now reports the observed boundary
honestly (Resource Timing activity plus a quiet window), but it does not track in-flight
instrumented requests, so it is not yet a promise that "everything settled". Choosing an
authoritative readiness signal remains a product decision.

### Decision 3 — Should intentional cancellation be benign?

**Today:** every `aborted` measurement is escalated to at least `warning` and appears under
`concern`.

**Decision needed:** keep that conservative rule, add an explicit cancel-intent signal, treat
`aborted` as neutral, or make the classification configurable.

**Constraint:** fetch exposes an abort reason message but it is not a reliable intent signal; XHR
exposes no reason at all. A reliable rule requires an application-supplied signal before
`abort()`.

### Decision 4 — Do non-HTTP transports belong in the model?

**Today:** no. WebSocket, SSE and WebRTC are deliberately excluded.

**If they are brought in scope**, they cannot reuse `RequestMeasurement` unchanged: they need a
different lifecycle (open/streaming/closed), different outcomes (close code/reason), different
metrics (time to first message, stream duration, bytes in/out) and a decision about whether page
thresholds apply. That is a model addition, not an extra installer.

**Options:** a separate public API, a separate entry point/package, or remain excluded. This page
records exclusion as the current decision.

### Decision 5 — Should request bytes be actual downloaded bytes?

**Today:** declared `Content-Length` only.

**To measure the decoded body for a request** you must either read/tee the body (breaking the
no-body guarantee and changing application-visible promise semantics) or rely on Resource Timing,
which is page-level, asynchronous and not tied to a `RequestMeasurement`.

**Options:** keep declared bytes; add an explicit opt-in body-tee mode; or keep decoded bytes
page-level only.

## 7. Changing this contract

A change to this table is a product and public-API decision:

- new instrumentation needs tests for pass-through behaviour, isolation and uninstall;
- a new measurement shape is a public type change and needs a changeset;
- a new classification rule must state what happens to deltas, trends and the session summary;
- documentation must remove the item from this page rather than leaving two answers.

If you are unsure whether a transport is supported, check this page first. If it is not listed as
in scope, it is not measured.
