# Example 7 — Testing

TracePulse is built for deterministic tests: configuration is pure, durations are derived from
plain numbers, and the core instance accepts an injected clock and id factory.

**Level:** advanced · **Concept:** pure seams · **Related:**
[Architecture — quality](../docs/guide/architecture.md)

[⬅ Back to examples index](./README.md)

---

## 1. Configuration without any globals

`resolveConfig()` is a pure function. No browser, no fetch, no monitor:

```ts
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '@codewithrajat/tracepulse'

describe('monitoring config', () => {
  it('merges one boundary and keeps the other', () => {
    const config = resolveConfig({
      exclude: ['/telemetry'],
      thresholds: { timeToResponseMs: { warningMs: 1500 } },
    })

    expect(config.thresholds.timeToResponseMs.warningMs).toBe(1500)
    expect(config.thresholds.timeToResponseMs.criticalMs).toBe(3000)
    expect(config.exclude).toEqual(['/telemetry'])
  })

  it('does not share state with the caller', () => {
    const rules = ['/a']
    const config = resolveConfig({ exclude: rules })

    rules.push('/b')
    expect(config.exclude).toEqual(['/a'])
  })
})
```

## 2. Assert the error contract

```ts
it('rejects a crossed pair after merging', () => {
  expect(() => resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000 } } })).toThrow(
    RangeError,
  )
})

it('rejects the legacy single-number shape', () => {
  // @ts-expect-error — intentionally invalid input
  expect(() => resolveConfig({ thresholds: { timeToResponseMs: 2000 } })).toThrow(TypeError)
})

it('rejects an empty exclusion rule', () => {
  expect(() => resolveConfig({ exclude: [''] })).toThrow(TypeError)
})
```

## 3. Durations from a hand-built measurement

The measurement model is public, so you can test your own reporting logic without installing
anything:

```ts
import { elapsedMs, getRequestDurations, type RequestMeasurement } from '@codewithrajat/tracepulse'

const measurement: RequestMeasurement = {
  id: 'req-1',
  url: 'https://api.test/items',
  method: 'GET',
  transport: 'xhr',
  lifecycle: 'completed',
  timing: { startedAt: 100, responseStartedAt: 180, responseCompletedAt: 260, completedAt: 260 },
  response: { status: 200, ok: true },
  outcome: { kind: 'success' },
}

getRequestDurations(measurement.timing)
// { queueMs: undefined, durationMs: 160, timeToResponseMs: 80, responseBodyMs: 80 }

elapsedMs(undefined, 10) // undefined — never 0
elapsedMs(20, 10) // undefined — inverted ranges are unavailable, not negative
```

## 4. Deterministic core instance

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

it('records a pulse with injected clock and id', () => {
  const pulse = createTracePulse({ clock: () => 1_000, idFactory: () => 'id-1' })
  pulse.start()

  expect(pulse.pulse('render', { ms: 12 })).toEqual({
    id: 'id-1',
    name: 'render',
    timestamp: 1_000,
    data: { ms: 12 },
  })

  pulse.dispose()
})
```

## 5. End-to-end monitor test

The monitor reads the **global** `fetch` when it starts, so stub the global before creating it
and stop it in `finally` — only one monitor may run per module instance.

```ts
import { afterEach, expect, it, vi } from 'vitest'
import { createMonitor } from '@codewithrajat/tracepulse'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('reports one row for a completed GET', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 200 })),
  )

  const table = vi.spyOn(console, 'table').mockImplementation(() => {})
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  const monitor = createMonitor()
  try {
    await fetch('https://api.test/items')
  } finally {
    monitor.stop()
  }

  expect(table).toHaveBeenCalledTimes(1)

  const row = table.mock.calls[0]?.[0]?.[0] as Record<string, string>
  expect(row['Method']).toBe('GET')
  expect(row['Lifecycle']).toBe('completed')
  expect(row['Outcome']).toBe('success')
  expect(row['Time to response']).toMatch(/\(\w+\)$/)
  expect(log).toHaveBeenCalledTimes(1)
})
```

Two details that make this test stable:

- the stub must return a **promise** (`async () => …`), because the fetch wrapper adopts the
  original promise; returning a bare `Response` produces no terminal snapshot;
- assert on counts and labels, not on milliseconds — the clock is `performance.now()` and is
  not injectable through the public monitor API.

## 6. XHR in a DOM environment

XHR instrumentation needs a real `XMLHttpRequest`. Under `environment: 'jsdom'` (or Vitest
browser mode) the same pattern works:

```ts
it('reports a 404 as completed + http-error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 })),
  )
  const table = vi.spyOn(console, 'table').mockImplementation(() => {})

  const monitor = createMonitor()
  try {
    await fetch('https://api.test/missing')
  } finally {
    monitor.stop()
  }

  const row = table.mock.calls[0]?.[0]?.[0] as Record<string, string>
  expect(row['Lifecycle']).toBe('completed')
  expect(row['Outcome']).toBe('http-error')
})
```

## Things to notice

- The installer classes, reporter and threshold evaluator are **not exported**; test them
  through the public API only.
- `vi.useFakeTimers()` does not make request durations predictable (the instrumentation uses a
  monotonic clock). Prefer structural assertions.
- Parallel tests can trip the single-monitor guard. Keep monitor tests serial, or call `stop()`
  in a `finally` block as above.
- `console.table` receives one row per report in the default grouped mode. Read a specific
  request with `calls[index][0][0]`. With `console.replace: true`, the newest call holds the
  accumulated session rows instead.

## Common mistakes

| Symptom                            | Cause                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `INVALID_STATE` in the second test | A previous monitor was never stopped                                          |
| No `console.table` call            | The stub returned a non-promise, or fetch was stubbed after `createMonitor()` |
| Durations asserted as `0`          | You expected a fake timer to control `performance.now()`                      |
| `@ts-expect-error` unused warning  | The input became valid — check the migration shape                            |

## Next

- [SSR and workers](./ssr.md) — test the platform guards too.
- [Core events and plugins](./core-events.md) — plugin behaviour under test.

[⬅ Back to examples index](./README.md)
