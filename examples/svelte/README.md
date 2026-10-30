# Svelte examples

TracePulse ships **no Svelte package**. Svelte's `onMount` cleanup and context API cover both
integration needs: an instance scoped to the app, and a page-global monitor.

**Applies to:** Svelte 4 and 5, SvelteKit · **Related:**
[Architecture — framework integration](../../docs/guide/architecture.md)

[⬅ Back to examples index](../README.md)

---

## 1. App-scoped instance with context

`src/lib/telemetry/trace-pulse.ts`

```ts
import { setContext, getContext } from 'svelte'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

const KEY = Symbol('tracePulse')

/** Call from the root component's `<script>`; returns the instance. */
export function provideTracePulse(): TracePulse {
  const pulse = createTracePulse({ name: 'svelte-app', maxHistory: 100 })
  pulse.start()

  setContext(KEY, pulse)
  return pulse
}

export function useTracePulse(): TracePulse {
  const pulse = getContext<TracePulse | undefined>(KEY)
  if (pulse === undefined) {
    throw new Error('provideTracePulse() must be called in the root component')
  }
  return pulse
}
```

`src/App.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { provideTracePulse } from '$lib/telemetry/trace-pulse'
  import Checkout from '$lib/Checkout.svelte'

  const pulse = provideTracePulse()

  onMount(() => () => pulse.dispose())
</script>

<Checkout />
```

`src/lib/Checkout.svelte`

```svelte
<script lang="ts">
  import { useTracePulse } from '$lib/telemetry/trace-pulse'

  const pulse = useTracePulse()

  const submit = () => pulse.pulse('checkout:submit', { step: 2 })
</script>

<button type="button" on:click={submit}>Pay</button>
```

Svelte 5 runs the same lifecycle: `onMount`'s returned function is the cleanup, and `setContext`
is valid during component initialisation.

## 2. SvelteKit: request monitor in the layout

```svelte
<!-- src/routes/+layout.svelte (Svelte 4) -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { createMonitor } from '@codewithrajat/tracepulse'

  onMount(() => {
    if (!browser) return

    const monitor = createMonitor({
      enabled: import.meta.env.DEV,
      exclude: ['/telemetry', '/health'],
    })

    return () => monitor.stop()
  })
</script>

<slot />
```

Svelte 5 without legacy reactivity — use `$effect`:

```svelte
<script lang="ts">
  import { browser } from '$app/environment'
  import { createMonitor } from '@codewithrajat/tracepulse'

  $effect(() => {
    if (!browser) return

    const monitor = createMonitor({ exclude: ['/telemetry'] })
    return () => monitor.stop()
  })
</script>
```

`$effect` returns a teardown, which is exactly the `stop()` contract.

> SvelteKit prerenders components on the server. The `browser` guard is what keeps the monitor
> out of the server bundle's runtime path; without it, `createMonitor()` patches the server's
> process-wide `fetch`.

## 3. Feature-level instance

```ts
import { onMount } from 'svelte'
import { createTracePulse } from '@codewithrajat/tracepulse'

export function createFeaturePulse(name: string) {
  const pulse = createTracePulse({ name, maxHistory: 20 })

  onMount(() => {
    pulse.start()
    return () => pulse.dispose()
  })

  return pulse
}
```

Because `onMount` only runs in the browser, this pattern is SSR-safe by construction.

## 4. HMR

Vite reloads Svelte components in place, so a module-level monitor is re-created when its module
is re-executed. Guard it:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor()

if (import.meta.hot) {
  import.meta.hot.dispose(() => monitor.stop())
}
```

## Pitfalls

| Symptom                                  | Cause                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| `getContext` throws                      | `useTracePulse()` called outside the component tree    |
| Instance survives navigation             | Created in a page component instead of the layout/root |
| Requests leak between users in prerender | Monitor created without the `browser` guard            |
| Reports stop after a hot reload          | The previous monitor was disposed but never restarted  |

## Related documentation

- [Lifecycle control](../lifecycle.md) — stop/start semantics.
- [React examples](../react/README.md) — the same lifecycle problem in another model.
- [SSR and workers](../ssr.md) — platform guards.

[⬅ Back to examples index](../README.md)
