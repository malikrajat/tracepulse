# Monitor integration (Step 9)

Public lifecycle surface for request monitoring. `createMonitor()` is the only new export
besides the `Monitor` type; transport installers, the reporter factory and the threshold
evaluator stay internal.

Source: [`src/monitor/monitor.ts`](../../src/monitor/monitor.ts).

## Public API

```ts
function createMonitor(config?: MonitorConfigInput): Monitor

interface Monitor {
  start(): this
  stop(): this
  page(): PageLoadMeasurement | undefined
  reportPage(): this
}
```

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({
  exclude: ['/telemetry'],
  console: { showTable: false },
})

monitor.stop()
monitor.start() // restart; safe to alternate
```

`createMonitor()` resolves the input once with `resolveConfig()`, so invalid configuration
throws the same `TypeError` / `RangeError` as the configuration API.

## Startup matrix

| `enabled` | `autoStart` | `createMonitor()` result | `start()`                |
| --------- | ----------- | ------------------------ | ------------------------ |
| `true`    | `true`      | Installs instrumentation | No-op while running      |
| `true`    | `false`     | Idle monitor             | Installs instrumentation |
| `false`   | `true`      | Idle monitor             | No-op forever            |
| `false`   | `false`     | Idle monitor             | No-op forever            |

With `enabled: true`, `stop()` uninstalls both transports and clears the running state.
Calling `start()` again re-installs from the current globals. `start()` and `stop()` are
idempotent and return the monitor for chaining. `enabled` is read once while resolving the
configuration; V1 exposes no runtime toggle, so the last two rows are permanent for that
monitor object.

## Wiring

`start()` owns three internal calls:

1. `installFetchInstrumentation({ exclude, onMeasurement: reporter })`
2. `installXhrInstrumentation({ exclude, onMeasurement: reporter })`
3. `installPageTimingInstrumentation({ mode, spa, settleMs, resources, exclude, onPageLoad })`
   when `page.enabled` is true.

The request callback is `createConsoleReporter(resolvedConfig)`. The reporter already ignores
`pending` / `headers-received` snapshots, so each request produces one report. `exclude` is
the resolved configuration array; the installers apply the existing substring semantics. The
page callback is the same reporter's `reportPageLoad`, so the page report shares the session's
request totals. The page installer is a no-op without `window`, so Node/SSR starts no timers.
`stop()` uninstalls page observation together with both transports; a bounded (`once`)
snapshot remains available through `page()`.

Fetch is installed first. If the fetch installer throws, nothing has been installed and the
monitor stays idle. If the XHR installer throws, the fetch installation is uninstalled before
the error is rethrown. The active-monitor token and running state are only published after
both calls succeed, so a failed `start()` can be retried.

Nothing else is public: `installFetchInstrumentation`, `installXhrInstrumentation`,
`createConsoleReporter`, `reportMeasurement`, `evaluateThreshold` and the monitor class are
not exported from the package root.

## Single active monitor

V1 supports one running monitor per loaded module instance. The transport installers are single-install; a
second active owner would either duplicate reports or make two monitors compete for one
uninstall function. Starting a second monitor throws:

```ts
TracePulseError: Another TracePulse monitor is already running; …
code: 'INVALID_STATE'
```

Idle monitors may coexist. A disabled monitor never claims the active slot. After
`stop()`, another monitor may start.

## Third-party patches and restart

The installers only restore a function when TracePulse's wrapper is still the installed
one. Therefore:

1. Monitor starts and installs wrapper `A`.
2. Another library installs wrapper `B` around `A`.
3. `monitor.stop()` deactivates `A`, removes its XHR listeners, and leaves `B` installed.
4. `monitor.start()` installs wrapper `C` around the current `B`.

`A` stays inactive beneath `B`; a request travels `C → B → A → native`, but only `C`
reports. The monitor tracks both uninstall functions and clears them on stop, so restarting
does not accumulate active TracePulse wrappers.

This behaviour is tested for both `fetch` and XHR, including the “third-party patch survives
stop” and “restart reports once” cases.

## In-flight requests

`stop()` is observation-only. It never calls `AbortController.abort()`, never changes a
promise, and never touches an XHR's native lifecycle. The installers deactivate their
context before restoring/returning, so:

- fetch: an in-flight request's terminal handler sees `isActive() === false` and emits no
  terminal snapshot. The caller still receives the original `Response` or rejection.
- XHR: `disposeRequest()` detaches every listener from each tracked request. A late
  `load`/`error`/`timeout`/`abort` event has no TracePulse listener and produces no snapshot.

Snapshots already delivered before `stop()` are retained by whatever consumed them; the
console reporter ignores `pending` and `headers-received`. A request that was in flight
before `stop()` is not re-observed by a later `start()`; only requests started afterwards are
reported. No new lifecycle event is introduced for this case.

`stop()` keeps the running state and active-monitor token until both uninstalls finish, so a
reentrant `start()` cannot publish a half-stopped monitor and a competing monitor cannot
claim the realm while old wrappers are still installed.

## Failure isolation

The reporter already wraps every console call. `stop()` also catches uninstall failures and
still attempts both transports, so cleanup cannot throw into application code. `start()`
rolls back the fetch installation if the XHR installation unexpectedly throws. If the fetch
installation itself throws, no transport is left installed and the monitor does not claim the
active slot.

## Tests

[`tests/monitor/monitor.spec.ts`](../../tests/monitor/monitor.spec.ts) covers default
auto-start, both transports installed for `autoStart: true`, neither installed for
`autoStart: false` or `enabled: false`, original-function restoration, idempotent start/stop,
restart, partial nested console configuration, caller-configuration immutability, exclusions,
console-disabled silence, config errors, the single-active-monitor rule, fetch-installer
failure, XHR-installer rollback, in-flight requests settling after stop or restart,
third-party fetch/XHR patches, and reporter failures not changing fetch/XHR outcomes.
[`public-api.spec.ts`](../../tests/monitor/public-api.spec.ts) imports through the package
name and proves the internal helpers are not exposed, and
[`monitor.test-d.ts`](../../tests/types/monitor.test-d.ts) locks the public type surface.

[`tests/integration/public-api.integration.spec.ts`](../../tests/integration/public-api.integration.spec.ts)
drives the public entry point across fetch/XHR success, HTTP error, network error, timeout
and abort outcomes, threshold boundaries and console colors, concurrent requests, start/stop,
rollback/retry, and third-party patch preservation. The optional
[`scripts/browser-smoke.mjs`](../../scripts/browser-smoke.mjs) repeats the transport,
threshold-color and lifecycle checks in real headless Chromium.

See [V1 release readiness](./release-readiness.md) for the current gate results and the
pending versioning decision.

## Limitations

- One running monitor per loaded module instance.
- Instrumentation covers globals present when `start()` runs. A `fetch` or
  `XMLHttpRequest` added to the realm after `start()` is not observed.
- No multi-realm or duplicate-package coordination; like the installers, the active-monitor
  guard is per module instance.
- The package still does not expose raw measurements, the reporter factory or the
  threshold evaluator; request and page monitoring are console-only in V1.
- Page measurement is browser-only. SPA segments require `page.mode: "continuous"` and
  `page.spa: true`; soft navigations have no browser load/paint milestones.
