# Example 6 — Core events and plugins

`TracePulse` is the generic primitive in the package: a typed event emitter with history,
sampling and a plugin lifecycle. It installs nothing and touches no globals, so it is safe
anywhere — including the server.

> The `1.0.0` README describes this instance as a reference implementation. It works, but the
> request monitor is the subsystem with the richest contract.

**Level:** advanced · **Concept:** `createTracePulse()` · **Related:**
[Core concepts](../docs/guide/core-concepts.md) · [Plugins](../docs/guide/plugins.md)

[⬅ Back to examples index](./README.md)

---

## Create and record

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

const pulse = createTracePulse({ name: 'checkout', maxHistory: 100 })

pulse.start()

const event = pulse.pulse('cart:open', { items: 3 })
// { id: 'tp_…', name: 'cart:open', timestamp: 1730…, data: { items: 3 } }

pulse.dispose()
```

`pulse()` returns the recorded event, or `undefined` when the instance is not running, is
disabled, or the pulse was sampled out. It throws `INVALID_ARGUMENT` for an empty name or a
non-object payload.

## Subscribe

```ts
const off = pulse.on('pulse', (event) => {
  console.debug(`[${event.timestamp}] ${event.name}`, event.data)
})

pulse.once('start', ({ timestamp }) => console.log('started at', timestamp))

off()
```

| Event     | Payload         | When                                          |
| --------- | --------------- | --------------------------------------------- |
| `start`   | `{ timestamp }` | status becomes `running`                      |
| `stop`    | `{ timestamp }` | status becomes `stopped`                      |
| `pulse`   | `PulseEvent`    | a pulse is recorded                           |
| `error`   | `Error`         | a plugin teardown threw                       |
| `dispose` | `{ timestamp }` | disposal starts, before listeners are cleared |

Dispatch is synchronous. A throwing listener aborts the remaining listeners and propagates to
the caller.

## Plugins

A plugin is `{ name, setup(api) }`. `setup()` receives a narrow API and may return a teardown.

```ts
import { createTracePulse, type TracePulsePlugin } from '@codewithrajat/tracepulse'

const batch: unknown[] = []

const batching: TracePulsePlugin = {
  name: 'batching',
  setup(api) {
    const stopListening = api.on('pulse', (event) => {
      batch.push(event)
      if (batch.length >= 20) {
        console.info('flush', batch.splice(0))
      }
    })

    return () => {
      stopListening()
      if (batch.length > 0) {
        console.info('flush on teardown', batch.splice(0))
      }
    }
  },
}

const pulse = createTracePulse({ name: 'app' }).use(batching)
pulse.start()
```

Rules enforced by `use()`:

| Situation                       | Result                                                |
| ------------------------------- | ----------------------------------------------------- |
| Duplicate plugin name           | `TracePulseError` `INVALID_ARGUMENT`                  |
| Missing/blank `name` or `setup` | `TracePulseError` `INVALID_ARGUMENT`                  |
| `setup()` throws                | rollback + `TracePulseError` `PLUGIN_ERROR` (`cause`) |
| Teardown throws                 | emitted on `error`; other teardowns still run         |

## History

```ts
const pulse = createTracePulse({ maxHistory: 3 })
pulse.start()

pulse.pulse('a')
pulse.pulse('b')
pulse.pulse('c')
pulse.pulse('d')

pulse.history.map((e) => e.name) // ['b', 'c', 'd'] — oldest first, bounded
```

- `maxHistory` defaults to `50`; `0` disables storage.
- With `maxHistory: 0` events are still **emitted and returned**, just not stored.
- `history` is a frozen copy of the array; the individual events inside are not frozen.
- `clearHistory()` empties the buffer.

## Sampling

```ts
createTracePulse({ sampleRate: 0.1 }) // ~10% of pulses
```

`0` and `1` short-circuit without calling `Math.random()`. Sampling is decided per pulse, so a
high-traffic feature can be sampled down without changing the call sites.

## Deterministic behaviour

Both injectables exist so tests and replays are reproducible:

```ts
const pulse = createTracePulse({
  clock: () => 1_000,
  idFactory: () => 'id-1',
})

pulse.start()
pulse.pulse('x') // { id: 'id-1', name: 'x', timestamp: 1000 }
```

## Shutdown

```ts
pulse.dispose()
```

- runs plugin teardowns in reverse registration order;
- emits `dispose`, then clears every listener;
- is idempotent;
- after disposal, `start()`, `stop()`, `pulse()`, `on()`, `use()` and `clearHistory()` throw
  `INVALID_STATE`. Only `off()`, `dispose()` and the read-only accessors remain safe.

## Things to notice

- Nothing is recorded while the instance is `idle` or `stopped`; `pulse()` is a no-op.
- `data` must be a non-null, non-array object. Primitives, arrays, `null` and functions are
  rejected; class instances are accepted because the check is structural.
- The instance is not wired to the monitor; the two subsystems are independent.
- Creating one instance per request on the server is the supported pattern.

## Common mistakes

| Symptom                                   | Cause                                                  |
| ----------------------------------------- | ------------------------------------------------------ |
| `pulse()` returns `undefined`             | Instance not started, `enabled: false`, or sampled out |
| `INVALID_ARGUMENT: pulse(name) requires…` | Empty/whitespace name                                  |
| `INVALID_STATE` after cleanup             | Calling methods after `dispose()`                      |
| Teardown never runs                       | `dispose()` was never called                           |

## Next

- [Testing](./testing.md) — assert this behaviour deterministically.
- [SSR and workers](./ssr.md) — per-request instances.

[⬅ Back to examples index](./README.md)
