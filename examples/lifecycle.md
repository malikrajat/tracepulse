# Example 5 — Lifecycle control

Start monitoring late, stop it early, restart it, and understand what happens to requests that
are already in flight.

**Level:** intermediate · **Concept:** `start()` / `stop()` · **Related:**
[API — request monitoring](../docs/guide/api.md)

[⬅ Back to examples index](./README.md)

---

## Deferred start

`autoStart: false` creates an idle monitor that installs nothing until you ask:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({ autoStart: false })

// ... bootstrapping, auth, feature flags ...

if (user.hasDebugAccess) {
  monitor.start()
}
```

Useful when monitoring should depend on a runtime condition that is not known at import time.

## Never start

```ts
createMonitor({ enabled: false })
```

`enabled` is read once, when the configuration is resolved. A disabled monitor can never start,
and `start()` is a silent no-op — it does not throw, so conditional call sites stay simple:

```ts
createMonitor(flags.monitoring ? {} : { enabled: false }).start()
```

This also means a disabled monitor never claims the single active slot, so an enabled monitor
can run alongside it.

| `enabled` | `autoStart` | Result               |
| --------- | ----------- | -------------------- |
| `true`    | `true`      | installs immediately |
| `true`    | `false`     | idle until `start()` |
| `false`   | either      | idle forever         |

## Idempotency

```ts
monitor.start().start().start() // one installation
monitor.stop().stop() // one uninstall
```

Both methods return the monitor, so they can be chained and called from cleanup paths without
guards.

## Stop during a request

```ts
const controller = new AbortController()

const pending = fetch('/api/slow')

monitor.stop() // no cancellation, no error

await pending // still resolves normally
```

`stop()` only stops **observation**. Rules:

- fetch: the request keeps its original promise and result; no terminal snapshot is emitted
  after `stop()`.
- XHR: listeners are detached from every in-flight request, so a late `load`/`error`/`abort`
  produces no report.
- Snapshots already emitted stay emitted; the reporter ignores the non-terminal ones.
- No synthetic "stopped" or "aborted" report is produced.

## Restart

```ts
monitor.stop()
// ...
monitor.start() // re-reads the current global fetch/XHR and wraps them again
```

Requests made after the second `start()` are observed normally. A request that was in flight
when you stopped is **not** re-reported.

## Only one monitor at a time

```ts
const first = createMonitor()
const second = createMonitor({ autoStart: false })

second.start()
// TracePulseError: Another TracePulse monitor is already running;
// call stop() on it before starting this monitor
// code: 'INVALID_STATE'
```

The guard belongs to the loaded module instance. Duplicate copies of the package (two versions
in one bundle) and separate realms are not coordinated, so keep a single monitoring module.

## Session-scoped monitoring

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({ enabled: import.meta.env.DEV })

window.addEventListener('pagehide', () => monitor.stop(), { once: true })
```

Stopping on `pagehide` is optional — the page is going away — but it keeps intent explicit when
the same module is reused in an iframe or a long-lived shell.

## Things to notice

- The monitor has no `dispose()`; `stop()` is the cleanup.
- Listening is global: every `fetch`/XHR call in the page is observed while it runs.
- A third-party wrapper installed after TracePulse is preserved by `stop()`, and a later
  `start()` wraps it without double-reporting.
- `enabled` cannot be toggled; to change it, stop the monitor and create a new one.

## Common mistakes

| Symptom                                     | Cause                                                      |
| ------------------------------------------- | ---------------------------------------------------------- |
| "Nothing is monitored"                      | Created with `autoStart: false` and never called `start()` |
| `INVALID_STATE` on start                    | Another monitor (or a hot-reload duplicate) is running     |
| Requests stopped being reported mid-session | `stop()` was called                                        |
| Config changes have no effect               | Configuration is fixed at creation time                    |

## Next

- [Core events and plugins](./core-events.md) — monitor your own application events too.
- [SSR and workers](./ssr.md) — avoid installing in the wrong environment.

[⬅ Back to examples index](./README.md)
