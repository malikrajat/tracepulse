# Example 1 — Basic monitoring

The smallest useful setup: import, create, make a request, read the console.

**Level:** beginner · **Concept:** `createMonitor()` auto-start · **Related:**
[Getting started](../docs/guide/getting-started.md)

[⬅ Back to examples index](./README.md)

---

## The whole example

`src/telemetry.ts`

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

// `enabled: true` and `autoStart: true` are the defaults, so this starts immediately.
export const monitor = createMonitor()
```

`src/main.ts`

```ts
import './telemetry'

// Nothing else to do: existing calls are observed as they are.
const response = await fetch('/api/items')
```

There is no wrapper API, no `withTracePulse()` and no per-call annotation. The monitor patches
`fetch` and `XMLHttpRequest` and leaves their behaviour alone.

## What you see

Every terminal request adds **one collapsed console group**. Expanding it shows that
request's table row and a summary of what needs attention:

```text
▶ TracePulse [NORMAL] · GET app.test/api/items · 200 · Time to response 120 ms (normal)
▶ TracePulse [WARNING] · POST app.test/api/pay · 200 · Time to response 940 ms (warning)

    (expanded) table row for POST app.test/api/pay
    TracePulse [WARNING] · 2 requests · 2 endpoints
      concern       POST app.test/api/pay — 1 request · Time to response 940 ms (warning)
      healthy       1 request across 1 endpoint · within limits
```

Nothing reprints the growing session, so the console stays one line per request. Set
`console.replace: true` if you prefer one table that is cleared and redrawn in place.

`Outcome` and `ID` are present in the real table but omitted above for width. `ID` is unique
per request, including concurrent requests to the same URL.

## Reading the result

| Field              | Why it says that                                                              |
| ------------------ | ----------------------------------------------------------------------------- |
| `Queue`            | For `fetch`, the short hand-off before the native transport accepts the call. |
| `Time to response` | For a completed `fetch`, the observed lifecycle ends when **headers** arrive. |
| `Response body`    | `unavailable` for fetch — the body is never read, so it cannot be measured.   |
| `UI render`        | `unavailable` unless your app supplies an explicit UI mark.                   |
| `Status 404`       | Still `completed` with outcome `http-error`; it is not a network failure.     |

## Stopping and restarting

```ts
import { monitor } from './telemetry'

monitor.stop() // uninstall instrumentation; in-flight requests keep their results
monitor.start() // reinstall; safe to call repeatedly
```

`start()` and `stop()` are idempotent. `stop()` does **not** cancel anything — a request that
was already in flight resolves or rejects exactly as it would have, it just stops being
reported.

## Guarding a hot-reload dev server

Vite re-executes modules on HMR. The old wrapper stays installed, so a new module-level
monitor would wrap it and every request would be reported twice. Stop the previous one:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor()

if (import.meta.hot) {
  import.meta.hot.dispose(() => monitor.stop())
}
```

## Things to notice

- The monitor owns no measurement state you can read; V1 reports to the console only.
- Only one monitor may run per module instance. A second `start()` throws a `TracePulseError`
  with code `INVALID_STATE`.
- Creating the monitor is cheap, but installation touches globals — do it once, at startup.
- `createMonitor()` is the only public request-monitoring entry point.

## Common mistakes

| Symptom                                 | Cause                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Nothing in the console                  | `console.enabled`/`enabled` is `false`, `console.level` hides it, or requests were made before `start()` |
| Two reports per request                 | Two monitors running (often a hot-reload duplicate)                                                      |
| `Response body` always `unavailable`    | Expected for `fetch`; only XHR can observe the body interval                                             |
| One collapsed line per request          | Expected: expand the group to see its row and the session summary                                        |
| Reports from one user in another's logs | A process-wide monitor on the server — see [example 8](./ssr.md)                                         |

## Next

- [Excluding requests](./exclusions.md) — stop reporting your analytics beacon.
- [Console output](./console-output.md) — every field and formatting option.

[⬅ Back to examples index](./README.md)
