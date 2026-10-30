# XMLHttpRequest instrumentation (internal)

> **Status:** Step 5 of the implementation plan, with the Step 6 request-identity and
> terminal-settlement guarantees described below. This module is internal: it is **not**
> re-exported from `src/index.ts`. `createMonitor()` now owns installation, passing the
> console reporter as `onMeasurement` and uninstalling on `stop()`.
>
> There is no fetch/XHR deduplication here. Threshold evaluation and console reporting are
> separate internal modules; this module performs neither.

Source: [`src/instrumentation/xhr.ts`](../../src/instrumentation/xhr.ts).

## Install and remove

```ts
import { resolveConfig } from '../../src/config/index.js'
import { installXhrInstrumentation } from './xhr.js'

const config = resolveConfig({ exclude: ['/telemetry'] })

const uninstall = installXhrInstrumentation({
  exclude: config.exclude,
  onMeasurement: (measurement) => queue(measurement),
})

const xhr = new XMLHttpRequest()
xhr.open('GET', '/api/users')
xhr.send() // observed automatically, no call-site changes

uninstall() // original prototype methods restored
```

- **Prototype patching, not a new abstraction.** `open`, `send` and `abort` on
  `XMLHttpRequest.prototype` are replaced with pass-through wrappers. The constructor,
  prototype chain, `instanceof`, properties and event model stay native. Application code
  keeps calling `new XMLHttpRequest()` and `xhr.addEventListener(...)`.
- **Repeated installs are idempotent.** While an installation is active, a second call
  returns the _same_ uninstall function and ignores its own options. Only **one
  installation per loaded module instance** is supported; there are no nested wrappers.
- **Environments without `XMLHttpRequest`** (Node, SSR, exotic runtimes) get a no-op
  uninstall; nothing throws.
- **Uninstall is idempotent** and stops all recording. It detaches monitoring listeners
  from requests that are still in flight, so no terminal snapshot is fabricated after
  uninstall. This matches fetch instrumentation.
- **Restoration is ownership-checked per method.** `open`, `send` and `abort` are restored
  independently and only when the installed function is still TracePulse's wrapper. A
  wrapper added later by another library is left untouched, and TracePulse's underlying
  wrapper becomes passive.
- An application (or a library) that captured a prototype method _before_ installation
  keeps using the uninstrumented function. That is a documented limitation.

## Callback contract

`onMeasurement` receives **one immutable snapshot per observable lifecycle update**:

1. `pending` — emitted synchronously once the native `send()` accepts the request.
2. Optionally, `headers-received` — emitted from `readystatechange` at
   `HEADERS_RECEIVED` when a usable status is readable.
3. Exactly one terminal snapshot — `completed`, `failed` or `aborted`.

Snapshots are deep-frozen (`measurement`, `timing`, `response`, `outcome`), so a consumer
may retain them and earlier objects are never mutated later. A listener that throws is
isolated: the error is swallowed and the application's XHR is unaffected. Omitting
`onMeasurement` installs the wrappers without attaching monitoring listeners, so they
stay pass-through.

If the native `send()` itself throws, no snapshot is produced: the request never reached
an observable lifecycle. The original exception is rethrown unchanged.

## Lifecycle and timing

All timestamps come from a single monotonic clock (`performance.now()`, or one `Date.now()`
fallback when `performance` is unavailable), so a duration never mixes clock domains.
`startedAt` is captured immediately before the native `send()` call.

| XHR event                                       | `lifecycle`        | `timing`                                                                             | `response`               | `outcome`                               |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ | ------------------------ | --------------------------------------- |
| `open()` succeeds                               | —                  | —                                                                                    | —                        | —                                       |
| `send()` accepted                               | `pending`          | `startedAt`                                                                          | —                        | —                                       |
| `readystatechange` at `HEADERS_RECEIVED`        | `headers-received` | `startedAt`, `responseStartedAt`                                                     | status/`ok`/headers      | —                                       |
| `load`, 2xx                                     | `completed`        | `startedAt`, `responseStartedAt` (if observed), `responseCompletedAt`, `completedAt` | status/`ok`/headers      | `success`                               |
| `load`, non-2xx (404/500)                       | `completed`        | same                                                                                 | status/`ok`/headers      | `http-error`                            |
| `load`, status 0                                | `completed`        | `startedAt`, `responseCompletedAt`, `completedAt`                                    | `status: 0`, `ok: false` | `http-error`                            |
| `error`                                         | `failed`           | `startedAt`, `responseStartedAt` (if headers arrived), `completedAt`                 | only if headers          | `network-error`                         |
| `timeout`                                       | `failed`           | same                                                                                 | only if headers          | `timeout`                               |
| `abort` event or `abort()` on an in-flight call | `aborted`          | same                                                                                 | only if headers          | `aborted`                               |
| `open()` while a request is in flight           | `aborted`          | `startedAt`, `completedAt` (or response fields if headers arrived)                   | only if headers          | `aborted`                               |
| Synchronous `send()` returns                    | `completed`        | `startedAt`, `responseCompletedAt`, `completedAt`                                    | status/`ok`/headers      | `success` / `http-error`                |
| `loadend` with no specific terminal event       | fallback           | as above                                                                             | as available             | `success` / `network-error` / `aborted` |

Notes:

- **HTTP statuses are never network failures.** 404 and 500 fire `load`, so they are
  `completed` + `http-error`, exactly as the shared model requires.
- **`ok` is derived, not read.** XHR has no `ok` property; it is `status >= 200 && status <= 299`.
  Status 0 is therefore `ok: false`.
- **Status 0 is never a success.** A `load` event with status 0 (for example `file://`) is
  recorded as `completed` + `http-error` because the existing model has no "unknown HTTP
  status" outcome. It is not reported as `success`, and no fresh response metadata is
  invented.
- **`headers-received` requires a readable status > 0.** If `readyState` reaches
  `HEADERS_RECEIVED` with status 0, no response-start boundary is claimed. A later
  `completed` snapshot simply has no `responseStartedAt`.
- **`responseCompletedAt` means the transport's completion event fired.** It does not mean
  the application consumed the body, processed it, or updated the UI.
- **`completedAt` is the end of the observed lifecycle**, not render completion.
- **Abort reasons are never fabricated.** XHR exposes no abort reason, so
  `AbortedOutcome.reason` is always absent.
- **A network-error message is never fabricated.** XHR's `error` event exposes no message,
  so only the outcome kind is recorded.

### Durations for XHR

For a normal asynchronous response where headers were observed:

- `timeToResponseMs = responseStartedAt - startedAt` — time to response headers.
- `responseBodyMs = responseCompletedAt - responseStartedAt` — body transfer time.
- `durationMs = completedAt - startedAt` — whole observed request duration.

If headers were not observed, `responseStartedAt` stays `undefined`; `responseBodyMs` and
`timeToResponseMs` then stay `undefined` rather than being fabricated. This is deliberate:
the library never guesses when headers arrived.

## Request identity

Each accepted `send()` captures one id and one start timestamp before any monitoring listener
is attached. Every snapshot of that request — `pending`, `headers-received` and the single
terminal one — carries the same id.

The default id comes from `createRequestId()` in
[`src/instrumentation/request-id.ts`](../../src/instrumentation/request-id.ts), the same
generator used by fetch instrumentation:

- `fetch` and XHR draw from **one shared sequence** through the same instrumentation module
  instance, so their ids cannot collide even when the platform UUID source is unavailable,
  mocked or repeats a value.
- The base id still uses `createId('req')` where available.
- The sequence is incremented once per accepted `send()`, never per event, so repeated
  `readystatechange`/terminal events keep the captured id.
- Re-opening and re-sending the same XHR instance creates a fresh request context and a fresh
  id; the previous request keeps its own id and is closed separately.
- A retry after a terminal event is a new `send()` and therefore a new id.
- The URL, method and payload are never used as identity, and no two requests are merged
  because they look alike. A caller-supplied `idFactory` replaces the default; uniqueness is
  then the caller's responsibility.

There is deliberately no correlation between an XHR record and a fetch record with the same
URL: they are separate requests with separate ids and transports.

## Duplicate prevention

Every observed `send()` creates one request context with a single `settled` flag. The first
terminal event (`load`, `error`, `timeout` or `abort`) or an explicit `abort()` settles it:

1. `settled` is set before any snapshot is built.
2. That first event fixes the lifecycle state, outcome and `completedAt`/`responseCompletedAt`.
   Later events cannot overwrite them or produce a second terminal measurement.
3. The request's listeners are removed in a `finally` block, even if the clock or a
   listener throws.
4. Later `loadend`, repeated `readystatechange` or duplicate terminal events find no
   listener (or an already-settled context) and cannot produce a second report.

`loadend` is only a defensive fallback for an event double or engine that omitted the specific
terminal event; it checks the `settled` flag first, so it never independently re-terminates a
request that `load`, `error`, `timeout` or `abort` already finalized. Cleanup during uninstall
or a failed native `send()` releases the context without emitting a terminal snapshot.

`headers-received` has its own `headersCaptured` flag, so repeated `readystatechange` at
`HEADERS_RECEIVED` emits it at most once.

A re-opened in-flight instance is closed once as `aborted` before the new `open()` state is
stored, so one request never produces two terminal snapshots.

## Preserving browser semantics

- The wrappers forward the exact arguments and receiver through `Reflect.apply` and return
  the native return value. `open`, `send` and `abort` arity (`Function.length`) is kept.
- Native exceptions are rethrown unchanged.
- No request headers, request body, response body, credentials, response type or timeout
  settings are read or changed.
- The response body is never read, cloned or buffered.
- Event listeners are added with `addEventListener`; the application's own listeners and
  `on*` handlers are untouched.
- Monitoring work is wrapped in `try`/`catch`, so a throwing clock, id factory, header
  accessor or consumer cannot change the application's XHR behaviour.
- A `load` with status 0 is not treated as success.
- HTTP 4xx/5xx remain completed HTTP responses.
- `completed`/`responseCompletedAt` do not claim that the application processed the
  response or updated its UI.

## Exclusions

`exclude` accepts the array produced by `resolveConfig(input).exclude` and applies the
Step 2 semantics unchanged: a request is excluded when its **resolved** URL contains a rule
as a **case-sensitive substring** (`url.includes(rule)`), including query string and hash.

- Default is `[]`: every supported request is monitored.
- The URL is resolved with `document.baseURI` (or `location.href`) the same way relative
  XHR URLs are resolved by the browser.
- A `URL`-like `open()` argument is read through `href`. A `Request` object is deliberately
  **not** read through `.url`: XHR stringifies a `Request`, so reporting its URL would
  describe a request that was never made.
- Excluded requests are forwarded untouched and emit **nothing** — no measurement, no
  listeners, no warning, no console noise.

## Tests

`tests/instrumentation/xhr.spec.ts` runs in the existing Node environment with a stubbed
`globalThis.XMLHttpRequest` and a stubbed `document.baseURI` (no network access). It covers
success, 404, 500, network error, timeout, explicit abort, abort after headers, status 0,
synchronous XHR, relative and `URL` input, exclusions (including a `resolveConfig`
integration case), concurrent id uniqueness, instance reuse, repeated `open`/`send`,
multiple and contradictory lifecycle events (including `loadend` before and after specific
terminal events, and other unexpected orderings), re-opened in-flight requests, throwing
listeners and clocks, repeated installation, uninstall with in-flight requests, third-party
patches, frozen snapshots, native return values/exceptions/arguments, and body
non-consumption.
`tests/instrumentation/request-identity.spec.ts` installs both transports and checks that
fetch and XHR ids never collide, including with a deliberately colliding UUID source.

The XHR double is a Node class that models event ordering; it is **not** a browser. Passing
tests do **not** prove real-browser CORS, redirect, cache/proxy, file-protocol or
sync-XHR-event behaviour. A real-browser test environment is not configured in this
project.

## Known limitations (summary)

| Limitation                               | Consequence                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Node-only tests                          | Browser-specific event timing and CORS/opaque/status-0 cases are modelled, not proven on a real network.                                   |
| Synchronous XHR may emit no events       | When `send()` returns without a terminal event, completion is inferred from the readable status; no header timestamp is invented.          |
| Status 0 has no dedicated outcome        | `load` with status 0 is `completed` + `http-error` with `ok: false`; never `success`.                                                      |
| No abort reason or network-error message | `AbortedOutcome.reason` and `NetworkErrorOutcome.message` stay absent; the platform exposes neither.                                       |
| One installation per module instance     | A second call returns the existing uninstall function and ignores its options.                                                             |
| Methods captured before installation     | References obtained earlier keep calling the uninstrumented functions.                                                                     |
| Uninstall after a third-party wrap       | Each method is restored only if still ours; a later third-party wrapper is never overwritten.                                              |
| No multi-monitor support                 | Independent monitor instances are not supported in this step.                                                                              |
| No fetch/XHR deduplication               | A request made through both transports would be observed twice; deduplication is out of scope.                                             |
| Duplicate library copies                 | Each module copy has its own sequence; UUID entropy still separates ids, but the deterministic cross-transport guarantee assumes one copy. |
| `open()` during an in-flight request     | The previous observation is closed as `aborted`, matching the native cancellation of that request.                                         |

Changing any of these (multi-instance support, an "unknown status" outcome, real-browser
tests, fetch/XHR deduplication) is an explicit later design decision, not an implementation
detail to be slipped in.
