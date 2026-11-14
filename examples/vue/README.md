# Vue examples

TracePulse ships **no Vue package**, but Vue's plugin and effect-scope lifecycle make the
integration the shortest of all frameworks: one plugin, one injection key, one composable.

**Applies to:** Vue 3 (+ Nuxt 3) · **Related:**
[Architecture — framework integration](../../docs/guide/architecture.md)

[⬅ Back to examples index](../README.md)

---

## 1. A plugin that owns the instance

```ts
// src/telemetry/trace-pulse.ts
import type { App, InjectionKey } from 'vue'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

export const TRACE_PULSE: InjectionKey<TracePulse> = Symbol('tracePulse')

declare module 'vue' {
  interface ComponentCustomProperties {
    /** Available in templates as `$tracePulse`. */
    $tracePulse: TracePulse
  }
}

export const tracePulsePlugin = {
  install(app: App): void {
    const pulse = createTracePulse({ name: 'vue-app', maxHistory: 100 })
    pulse.start()

    app.provide(TRACE_PULSE, pulse)
    app.config.globalProperties.$tracePulse = pulse

    // The app instance has no dispose hook; tie the instance to page unload.
    window.addEventListener('pagehide', () => pulse.dispose(), { once: true })
  },
}
```

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { tracePulsePlugin } from './telemetry/trace-pulse'

createApp(App).use(tracePulsePlugin).mount('#app')
```

## 2. Composable for components

```ts
// src/telemetry/use-trace-pulse.ts
import { inject } from 'vue'
import { TRACE_PULSE } from './trace-pulse'

export function useTracePulse() {
  const pulse = inject(TRACE_PULSE)
  if (pulse === undefined) {
    throw new Error('tracePulsePlugin is not installed')
  }
  return pulse
}
```

```vue
<script setup lang="ts">
import { useTracePulse } from '@/telemetry/use-trace-pulse'

const pulse = useTracePulse()

function submit(): void {
  pulse.pulse('checkout:submit', { step: 2 })
}
</script>

<template>
  <button type="button" @click="submit">Pay</button>
</template>
```

Throwing from the composable is intentional: a missing plugin is a setup bug, not a runtime
condition worth guarding at every call site.

## 3. Scope-bound instance for a feature

If a feature needs its own instance, bind it to the effect scope so it is disposed automatically:

```ts
import { onScopeDispose } from 'vue'
import { createTracePulse } from '@codewithrajat/tracepulse'

export function useFeaturePulse(name: string) {
  const pulse = createTracePulse({ name, maxHistory: 20 })
  pulse.start()

  onScopeDispose(() => pulse.dispose())

  return pulse
}
```

`onScopeDispose` runs when the owning component unmounts (or the `effectScope` is stopped), so
`dispose()` — which is terminal — is called exactly once per instance.

## 4. Request monitor

The monitor is page-global, so install it once in `main.ts`:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

if (!import.meta.env.SSR) {
  createMonitor({
    enabled: import.meta.env.DEV,
    exclude: ['/telemetry', '/health'],
  })
}
```

`import.meta.env.SSR` is `true` during Nuxt server rendering; in a plain Vite SPA it is always
`false`, so the guard is harmless.

### Nuxt

```ts
// plugins/telemetry.client.ts
import { createMonitor } from '@codewithrajat/tracepulse'

export default defineNuxtPlugin(() => {
  createMonitor({ exclude: ['/telemetry'] })
})
```

The `.client` suffix keeps the file out of the server build.

## 5. Reactivity notes

The `TracePulse` instance is deliberately **not reactive**: it is a plain object with methods.
Do not wrap it in `ref()` or `reactive()` — Vue would proxy it, and `dispose()`/`start()`
operate on the raw object anyway.

If the UI must react to recorded pulses, project them into a reactive array yourself:

```ts
import { ref } from 'vue'
import { createTracePulse } from '@codewithrajat/tracepulse'

const pulses = ref<string[]>([])
const pulse = createTracePulse({ name: 'vue-app' })

pulse.on('pulse', (event) => {
  pulses.value.push(event.name)
})
pulse.start()
```

## Pitfalls

| Symptom                                 | Cause                                                               |
| --------------------------------------- | ------------------------------------------------------------------- |
| `inject()` returns `undefined`          | Plugin not installed, or the composable is called outside `setup()` |
| Duplicate reports                       | Nuxt plugin not marked `.client`, so it also ran on the server      |
| `INVALID_STATE` on the second `start()` | Two monitors running (plugin plus a component-level one)            |
| Instance unreachable after HMR          | Vite re-executed the module; add `import.meta.hot.dispose`          |

## Related documentation

- [Core events and plugins](../core-events.md) — `on`, `once`, teardown.
- [Lifecycle control](../lifecycle.md) — stop/start rules.
- [SSR and workers](../ssr.md) — Nuxt and SSR guards.

[⬅ Back to examples index](../README.md)
