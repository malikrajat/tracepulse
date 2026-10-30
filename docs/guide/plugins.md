# Plugins

Plugins let you extend an instance without reaching into its internals. The API
they receive is intentionally narrow — the same API the docs test against — so
internal refactors cannot break third-party plugins.

## Contract

```ts
interface TracePulsePlugin {
  readonly name: string
  setup(api: TracePulsePluginApi): undefined | (() => void)
}

interface TracePulsePluginApi {
  readonly name: string
  readonly status: TracePulseStatus
  readonly history: readonly PulseEvent[]
  pulse(name: string, data?: PulseData): PulseEvent | undefined
  on<EventName extends keyof TracePulseEventMap>(
    event: EventName,
    listener: (payload: TracePulseEventMap[EventName]) => void,
  ): () => void
}
```

`setup()` may return a teardown function. It runs on `dispose()`, in **reverse**
registration order, and failures are isolated.

## Example

```ts
import { createTracePulse, type TracePulsePlugin } from '@codewithrajat/tracepulse'

const consolePlugin: TracePulsePlugin = {
  name: 'console',

  setup(api) {
    console.log(`[${api.name}] attached in state "${api.status}"`)

    const off = api.on('pulse', (event) => {
      console.log(`pulse: ${event.name}`, event.data ?? {})
    })

    return () => {
      off()
      console.log(`[${api.name}] detached`)
    }
  },
}

const pulse = createTracePulse({ name: 'app' }).use(consolePlugin)
```

## Rules

- **Names are unique per instance.** Registering the same name twice throws
  `INVALID_ARGUMENT`.
- **`setup()` is atomic.** If it throws, the plugin name is released and a
  `PLUGIN_ERROR` is thrown with the original error as `cause`, so a failed plugin
  never leaves a half-registered instance.
- **Teardown failures do not cascade.** If one teardown throws, the error is
  emitted on the `error` event and the remaining teardowns still run. A non-`Error`
  throw is wrapped in a `TracePulseError`.
- **Teardown runs while `status` is already `disposed`.** Do not call mutating
  methods from a teardown.

## Testing a plugin

Inject `clock` and use a small fake API object, or attach the plugin to a real
instance and assert through its events:

```ts
import { describe, expect, it, vi } from 'vite-plus/test'
import { createTracePulse } from '@codewithrajat/tracepulse'

it('records pulses through the plugin API', () => {
  const received: string[] = []

  createTracePulse()
    .use({
      name: 'collector',
      setup: (api) => api.on('pulse', (event) => received.push(event.name)),
    })
    .start()
    .pulse('a')
    .pulse('b')

  expect(received).toEqual(['a', 'b'])
})
```

## Design notes

The plugin API type lives in `src/core/types.ts` and is deliberately _structural_:
`TracePulse` implements it, but so can a test double. That means plugins can be unit
tested without constructing a full instance, and adding methods to `TracePulse`
cannot accidentally widen the plugin surface.
