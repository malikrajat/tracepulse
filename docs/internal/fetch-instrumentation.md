# Fetch instrumentation (internal)

> **Status:** Step 4 of the implementation plan, with the Step 6 request-identity and
> terminal-settlement guarantees described below. This module is internal: it is **not**
> re-exported from `src/index.ts`. `createMonitor()` now owns installation, passing the
> console reporter as `onMeasurement` and uninstalling on `stop()`.
>
> `XMLHttpRequest` instrumentation is a separate internal module (Step 5, see
> [`xhr-instrumentation.md`](./xhr-instrumentation.md)); this module does not install it.
> Threshold classification and reporting live in separate internal modules; this module
> still performs no deduplication or console output itself.

Source: [`src/instrumentation/fetch.ts`](../../src/instrumentation/fetch.ts).

## Install and remove

```ts
import { resolveConfig } from '../../src/config/index.js'
import { installFetchInstrumentation } from './fetch.js'

const config = resolveConfig({ exclude: ['/telemetry'] })

const uninstall = installFetchInstrumentation({
  exclude: config.exclude,
  onMeasurement: (measurement) => queue(measurement),
})

fetch('/api/users') // observed automatically, no call-site changes

uninstall() // restores the original fetch
```

- **Nothing to wrap.** Installing replaces `globalThis.fetch` with a pass-through wrapper, so
  existing application code — including libraries that call `fetch` internally — is observed.
- **Repeated installs are idempotent.** While an installation is active, a second call returns
  the _same_ uninstall function and ignores its own options. That prevents nested wrappers and
  double-counted requests. Only **one installation per loaded module instance** is supported
  in this step.
- **Environments without `fetch`** (SSR, older Node) get a no-op uninstall; nothing throws.
- **Uninstall is idempotent** and stops all recording, including for requests that were already
  in flight. The original `fetch` is restored only when this module's wrapper is still the
  installed function; if another library wrapped `fetch` after us, its wrapper is left alone.
- An application that captured `const f = window.fetch` _before_ installation keeps using the
  uninstrumented function. That is a documented limitation, not a bug.

## Callback contract

`onMeasurement` receives **one immutable snapshot per observable lifecycle update**:

1. `pending` — emitted **synchronously**, while the `fetch()` call is being observed.
2. Exactly one terminal snapshot — `completed`, `failed` or `aborted` — emitted from a promise
   handler (a microtask, after the original promise settles).

A per-request settlement flag makes the terminal snapshot strictly once-only. The first
terminal callback records the outcome and timestamps; any later callback for the same request
is ignored, so a duplicate settlement cannot emit a second report or overwrite the first one.
The native promise's resolution value and rejection reason are never changed (see below).

Snapshots are deep-frozen (`measurement`, `timing`, `response`, `outcome`), so a consumer may
retain them and earlier objects are never mutated later. A listener that throws is isolated:
the error is swallowed and the application's request is unaffected. Omitting `onMeasurement`
installs the wrapper without collecting anything: with no consumer it stays a pure pass-through
and returns the original promise, so the observation hop is paid only when something observes.

There is deliberately no event bus, no console output, no threshold evaluation and no
classification beyond the transport facts listed below.

## Lifecycle and timing

Only boundaries that `fetch()` can actually observe are recorded. All timestamps come from a
single monotonic clock (`performance.now()`, or one `Date.now()` whole-clock fallback when
`performance` is unavailable), so a duration never mixes clock domains.

| `fetch()` event                       | `lifecycle` | `timing`                                                    | `response`    | `outcome`                   |
| ------------------------------------- | ----------- | ----------------------------------------------------------- | ------------- | --------------------------- |
| Call observed                         | `pending`   | `startedAt`                                                 | —             | —                           |
| Promise resolves, 2xx                 | `completed` | `startedAt`, `responseStartedAt`, `completedAt` (all known) | status/`ok`/… | `success`                   |
| Promise resolves, non-2xx (404/500)   | `completed` | same                                                        | status/`ok`/… | `http-error`                |
| Rejects with `AbortError`             | `aborted`   | `startedAt`, `completedAt`                                  | —             | `aborted` (+ `reason`)      |
| Rejects while `signal.aborted`        | `aborted`   | `startedAt`, `completedAt`                                  | —             | `aborted`                   |
| Rejects with `TimeoutError`           | `failed`    | `startedAt`, `completedAt`                                  | —             | `timeout`                   |
| Any other rejection                   | `failed`    | `startedAt`, `completedAt`                                  | —             | `network-error` (+ message) |
| Original `fetch` throws synchronously | `failed`    | `startedAt`, `completedAt`                                  | —             | `network-error` (+ message) |

Notes:

- **HTTP statuses are never rejections.** 404 and 500 keep the promise resolved and produce
  `completed` + `http-error`, exactly as the shared model requires.
- **Rejection identity is preserved.** The promise handed to the caller adopts the original
  outcome, so it rejects with the same error object — not a copy and not a wrapper.
- **Abort detection** uses the platform's `AbortError`, corroborated by `signal.aborted`.
  `TimeoutError` (from `AbortSignal.timeout()`) is reported as a client-side `timeout`.
- **Other rejections are classified provisionally.** A rejection that is neither an abort nor a
  timeout is recorded as `failed` + `network-error` because **no HTTP response was received**.
  This is a category, not a diagnosis: the actual cause is **unknown** and TracePulse must not
  claim that DNS, TLS, a connection reset, CORS, an invalid URL or any other specific failure
  caused it. The platform does not expose that reliably, and the shared model has no
  "unknown rejection cause" outcome. Only `NetworkErrorOutcome.message` — the transport's own
  best-effort text — carries any further detail, and even that is not authoritative.
  Adding a distinct outcome for this case would be a Step 3 model change, deliberately out of
  scope here.
- **`completed` does not mean the request is finished from the application's point of view.**
  For a resolved fetch it means precisely: _the fetch promise settled and response headers are
  available_. It does **not** mean the body was fully consumed, nor that data was rendered. The
  `completedAt` timestamp is the end of the _observed_ fetch lifecycle, not body or render
  completion.

## Request identity

Every observed call captures its id **once**, at call time, before the native `fetch` is
invoked. The `pending` and terminal snapshots of that call therefore share the same id, while
a second call — including a retry, or a concurrent request to the exact same URL — gets its own.

The default id comes from `createRequestId()` in
[`src/instrumentation/request-id.ts`](../../src/instrumentation/request-id.ts), which is also
the default for XHR instrumentation:

- `fetch` and XHR draw from **one shared sequence** through the same instrumentation module
  instance, so ids cannot collide across transports even if the platform UUID source is
  missing, mocked or repeats a value.
- The base id still uses `createId('req')` (a `crypto.randomUUID()`-based id where available).
- The sequence is incremented once per request, never per lifecycle snapshot, so all snapshots
  of one request keep the id captured at start.
- Nothing is derived from the URL, HTTP method or payload, and no request is deduplicated
  because another request looks the same. Two concurrent `fetch('/api/items')` calls are two
  measurements.
- A caller-supplied `idFactory` replaces the default; uniqueness is then the caller's
  responsibility, and supplying separate factories can of course produce collisions.

There is deliberately no correlation between a fetch record and an XHR record with the same
URL: they are separate requests with separate ids and transports.

### What is measured, and what is not

| Boundary                     | Measured? | Where it comes from                             |
| ---------------------------- | --------- | ----------------------------------------------- |
| Observation start            | yes       | wrapper entry, `performance.now()`              |
| Response headers available   | yes       | fetch promise resolution                        |
| Failure / abort              | yes       | fetch promise rejection                         |
| Response body fully consumed | **no**    | never instrumented; `responseCompletedAt` unset |
| Browser-internal queue time  | **no**    | not exposed by `fetch()`                        |
| Server processing time       | **no**    | not separable without browser perf data         |
| Render / paint / UI update   | **no**    | needs an explicit UI boundary                   |

Because `responseCompletedAt` is never set by fetch instrumentation,
`getRequestDurations(timing).responseBodyMs` is always `undefined`. For a fetch measurement:

- `timeToResponseMs` = `responseStartedAt - startedAt` = time until headers were available.
- `durationMs` = `completedAt - startedAt` = the **same interval** (start → promise settlement),
  because `completedAt === responseStartedAt`. It is **time to response availability**, not full
  response-download time, not body-processing time and not server time.

That equality is intentional and must not be "fixed" by inventing a body timestamp: fetch
instrumentation simply cannot observe body consumption. A consumer that needs to distinguish
"headers available" from "body finished" must look at `responseCompletedAt`, which stays
`undefined` here. The console reporter must therefore never present a fetch `durationMs` as
full response-download time.

`headers-received` is still part of the shared model and is used by XHR instrumentation,
which can observe that transition separately. `fetch()` cannot, so it reports `completed`.

## Exclusions

`exclude` accepts the array produced by `resolveConfig(input).exclude` and applies the Step 2
semantics unchanged: a request is excluded when its **resolved** URL contains a rule as a
**case-sensitive substring** (`url.includes(rule)`), including query string and hash.

- Default is `[]`: every supported request is monitored.
- Matching against the resolved URL means `https://analytics.example.com` also excludes a
  relative `fetch('/collect')` to that origin, and `/telemetry` matches on any origin.
- Excluded requests are forwarded untouched and emit **nothing** — no measurement, no warning,
  no console noise.

## Isolation from application behaviour

The wrapper is a pass-through with observation bolted on:

- Forwarded arguments are exactly the caller's (`Reflect.apply` with `arguments`), including the
  0/1/2-argument cases, and `this` is preserved.
- Tracked requests receive a promise that **adopts** the original outcome: it resolves with the
  very same `Response` object and rejects with the very same error value. It is a separate
  promise object (one microtask hop) so that an ignored rejection still reaches the runtime's
  unhandled-rejection diagnostics; returning the original promise would mark it as handled and
  hide the application's own bug. Excluded and untracked requests receive the untouched original
  promise.
- The **original `Response` object** is returned; the body is never read, cloned or teed.
- HTTP error statuses stay resolved; network failures and aborts stay rejected.
- Monitoring work is wrapped in `try`/`catch` at every step (clock, metadata extraction, listener
  invocation). If any of it fails, the application still receives the original result or error.
- No request bodies, cookies, authorization headers or response bodies are recorded.

## Tests

`tests/instrumentation/fetch.spec.ts` and `tests/instrumentation/url.spec.ts` run in the
existing Node environment with a stubbed `globalThis.fetch` and a stubbed `document.baseURI`
(no network access). They cover success, 404, 500, rejection (including error identity and
"never resolves" behaviour), abort, timeout, string/`Request`/`URL` input, relative URLs,
exclusions (including a `resolveConfig` integration case), throwing listeners, repeated installs,
uninstall safety, argument/receiver forwarding, response identity, body non-consumption, the
absence of `responseCompletedAt`, no observation or promise hop without a sink, concurrent id
uniqueness, retry ids, repeated terminal-callback suppression and the robustness paths above.
`tests/instrumentation/request-identity.spec.ts` additionally installs both transports and
checks cross-transport id uniqueness, including a deliberately colliding UUID source.

A real-browser test environment is **not** configured in this project, so browser-specific
behaviour (CORS failures, opaque `no-cors` responses, `keepalive`) is exercised only through
duck-typed response objects, not through a real browser network stack. Passing tests therefore
do **not** prove real-browser CORS or opaque-response behaviour.

## Known limitations (summary)

| Limitation                           | Consequence                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic rejection cause is unknown   | Recorded provisionally as `failed` + `network-error`; no claim about DNS, TLS, CORS, URL parsing or connection failure                           |
| `completed` at promise settlement    | Means "headers available", not "body consumed" or "UI rendered"; `responseCompletedAt` is unset                                                  |
| `durationMs` for fetch               | Equals `timeToResponseMs` (time to response availability); never label it full download time                                                     |
| One installation per module instance | A second `installFetchInstrumentation()` returns the existing uninstall function and ignores its options; no nested wrappers                     |
| No multi-monitor support             | Independent monitor instances are not supported in this step; that needs a subscriber architecture                                               |
| `fetch` captured before installation | References obtained earlier keep calling the uninstrumented function                                                                             |
| One microtask hop on tracked calls   | Required so an ignored rejection still triggers the runtime's unhandled-rejection diagnostic; excluded/untracked calls keep the original promise |
| Uninstall after a third-party wrap   | TracePulse's wrapper becomes passive but is left in the chain; the third-party wrapper is never overwritten                                      |
| Node-only tests                      | No real-browser CORS/opaque-response proof yet; a browser test environment is a later, deliberate setup change                                   |
| Duplicate library copies             | Each module copy has its own sequence; UUID entropy still separates ids, but the deterministic cross-transport guarantee assumes one copy        |
| Fetch only (this module)             | `XMLHttpRequest` is instrumented by the separate Step 5 module; no fetch/XHR deduplication exists                                                |

Changing any of these (multi-instance support, an "unknown rejection" outcome, real-browser
tests) is an explicit later design decision, not an implementation detail to be slipped in.
