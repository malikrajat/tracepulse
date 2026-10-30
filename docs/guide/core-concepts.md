# Core concepts

## Lifecycle

```
idle ──start()──▶ running ──stop()──▶ stopped
  ▲                  │                   │
  └───── start() ────┘                   │
                     └── start() ────────┘

dispose() ──▶ disposed (terminal)
```

- `start()` and `stop()` are **idempotent** — calling them twice emits once.
- With `enabled: false`, `start()` is a no-op and the status stays `idle`.
- After `dispose()`, every mutating method throws `TracePulseError` with code
  `INVALID_STATE`. Only `off()`, `dispose()` and read-only accessors remain safe.

```ts
const pulse = createTracePulse()

pulse.status // 'idle'
pulse.start().start()
pulse.status // 'running'
pulse.stop()
pulse.status // 'stopped'
pulse.dispose()
pulse.status // 'disposed'
```

## Pulses

A pulse is a snapshot record:

```ts
interface PulseEvent {
  readonly id: string
  readonly name: string
  readonly timestamp: number
  readonly data?: Readonly<Record<string, unknown>>
}
```

`pulse()` is deliberately forgiving in one direction and strict in the other:

- It **returns `undefined`** (no throw) when the instance is not running, is
  disabled, or the pulse is sampled out. This lets callers branch cheaply.
- It **throws** `INVALID_ARGUMENT` for an empty name or a non-object payload.

```ts
const event = pulse.pulse('render', { ms: 12 })
if (event !== undefined) {
  // recorded
}
```

### Sampling

`sampleRate` is evaluated per pulse. Values `0` and `1` short-circuit (no `Math.random()`
call), which keeps tests deterministic:

```ts
createTracePulse({ sampleRate: 0 }) // never records
createTracePulse({ sampleRate: 1 }) // always records
createTracePulse({ sampleRate: 0.5 }) // ~half, decided by Math.random()
```

### History

History is a bounded in-memory buffer, oldest first:

```ts
const pulse = createTracePulse({ maxHistory: 2 })
pulse.start()
pulse.pulse('a')
pulse.pulse('b')
pulse.pulse('c')

pulse.history.map((event) => event.name) // ['b', 'c']
```

- `history` returns a **frozen array copy** — mutating the array never affects the instance.
  The event objects inside are not deep-frozen.
- `maxHistory: 0` disables storage but pulses are still emitted and returned.
- `clearHistory()` empties the buffer.

## Options

| Option       | Type           | Default        | Notes                            |
| ------------ | -------------- | -------------- | -------------------------------- |
| `name`       | `string`       | `"tracepulse"` | Trimmed; must be non-empty       |
| `enabled`    | `boolean`      | `true`         | `false` keeps the instance inert |
| `sampleRate` | `number`       | `1`            | Finite, `0`–`1`                  |
| `maxHistory` | `number`       | `50`           | Non-negative integer             |
| `clock`      | `() => number` | `Date.now`     | Timestamp source                 |
| `idFactory`  | `() => string` | UUID-based     | Id source                        |

Resolved options are exposed as a frozen object via `pulse.options`, which is handy
for diagnostics and tests.

## Events

```ts
const off = pulse.on('pulse', (event) => {
  // fully typed as PulseEvent
})

pulse.once('start', ({ timestamp }) => {
  // runs at most once
})

off()
```

| Event     | Payload         | Fired when                                    |
| --------- | --------------- | --------------------------------------------- |
| `start`   | `{ timestamp }` | Instance starts running                       |
| `stop`    | `{ timestamp }` | Instance stops                                |
| `pulse`   | `PulseEvent`    | A pulse is recorded                           |
| `error`   | `Error`         | A plugin teardown fails during `dispose()`    |
| `dispose` | `{ timestamp }` | Disposal starts, before listeners are cleared |

Dispatch is synchronous. A throwing listener aborts the remaining listeners and
propagates to the caller — this is intentional, so failures are never silent.

## Errors

Every validation error is a `TracePulseError` with a stable `code`:

| Code               | Raised by                                  |
| ------------------ | ------------------------------------------ |
| `INVALID_OPTION`   | Constructor / `resolveOptions`             |
| `INVALID_ARGUMENT` | `pulse()` arguments, `use()` plugin shape  |
| `INVALID_STATE`    | Any mutating call on a disposed instance   |
| `PLUGIN_ERROR`     | `setup()` failure, plugin teardown failure |

```ts
import { isTracePulseError } from '@codewithrajat/tracepulse'

try {
  pulse.pulse('')
} catch (error) {
  if (isTracePulseError(error) && error.code === 'INVALID_ARGUMENT') {
    // handle
  }
}
```

`invariant()` is exported for consumers writing their own validated APIs:

```ts
invariant(typeof value === 'string', 'INVALID_ARGUMENT', 'value must be a string')
// `value` is narrowed to string afterwards
```

## Disposal

`dispose()` runs plugin teardowns in reverse registration order, emits `dispose`,
then clears all listeners. It is idempotent and safe to call from cleanup hooks.

```ts
const pulse = createTracePulse()
try {
  pulse.start()
  // ...
} finally {
  pulse.dispose()
}
```

## Determinism

Two injectables make behaviour fully reproducible:

```ts
const pulse = createTracePulse({
  clock: () => 1_700_000_000_000,
  idFactory: () => 'id-1',
})

pulse.start()

expect(pulse.pulse('x')).toEqual({
  id: 'id-1',
  name: 'x',
  timestamp: 1_700_000_000_000,
})
```

## Server-side rendering

Importing the package has no side effects and touches no globals. The id fallback
is guarded by `typeof`, so it is safe on runtimes without `crypto.randomUUID`.
Create one instance per request rather than at module scope.
