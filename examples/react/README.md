# React examples

TracePulse ships **no React package**. It is a plain ES module with no framework imports, so
these recipes are lifecycle wrappers you own: a context provider for the core instance and a
module-level singleton for the request monitor.

**Applies to:** React 18 and 19 (client rendering) · **Related:**
[Architecture — framework integration](../../docs/guide/architecture.md)

[⬅ Back to examples index](../README.md)

---

## 1. Provider + hook for the core instance

Create the instance **inside the effect**, never with `useMemo`. React StrictMode runs
`setup → cleanup → setup` on the same component instance; `dispose()` is terminal, so a
memoized instance would be dead on the second setup and `start()` would throw
`INVALID_STATE`.

```tsx
// src/telemetry/TracePulseProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

const TracePulseContext = createContext<TracePulse | null>(null)

export function TracePulseProvider({ children }: { children: ReactNode }) {
  const [pulse, setPulse] = useState<TracePulse | null>(null)

  useEffect(() => {
    const instance = createTracePulse({ name: 'react-app', maxHistory: 100 })
    instance.start()
    setPulse(instance)

    return () => {
      setPulse(null)
      instance.dispose()
    }
  }, [])

  return <TracePulseContext.Provider value={pulse}>{children}</TracePulseContext.Provider>
}

/** `null` on the first render and after unmount. */
export function useTracePulse(): TracePulse | null {
  return useContext(TracePulseContext)
}
```

`src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TracePulseProvider } from './telemetry/TracePulseProvider'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TracePulseProvider>
      <App />
    </TracePulseProvider>
  </StrictMode>,
)
```

Consuming it:

```tsx
export function CheckoutButton() {
  const pulse = useTracePulse()

  return (
    <button type="button" onClick={() => pulse?.pulse('checkout:submit', { items: 3 })}>
      Pay
    </button>
  )
}
```

The optional call is deliberate: the context is `null` during the first render.

## 2. Request monitor at app bootstrap

The monitor should exist once for the whole page. Module scope is the simplest correct place in
a browser-only SPA:

```ts
// src/telemetry/monitor.ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({
  enabled: import.meta.env.DEV, // no console noise in production
  exclude: ['/telemetry', '/health'],
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => monitor.stop())
}
```

Import it once from `main.tsx`:

```ts
import './telemetry/monitor'
```

Do **not** put this inside a component. A component-scoped monitor is created after the
module-scoped one and its `start()` throws `INVALID_STATE`.

## 3. Next.js App Router

Keep everything behind a client boundary:

```tsx
// app/telemetry.tsx
'use client'

import { useEffect } from 'react'

export function Telemetry() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let stop: (() => void) | undefined

    void import('@codewithrajat/tracepulse').then(({ createMonitor }) => {
      const monitor = createMonitor({ enabled: process.env.NODE_ENV === 'development' })
      stop = () => monitor.stop()
    })

    return () => stop?.()
  }, [])

  return null
}
```

Mount it once in `app/layout.tsx`. The dynamic import keeps the instrumentation out of the
server bundle, and the `window` check covers prerendering.

## 4. Starting monitoring after login

Use `autoStart: false` when diagnostics should be gated on a runtime decision:

```ts
// src/telemetry/authorized.ts
import { createMonitor, type Monitor } from '@codewithrajat/tracepulse'

let monitor: Monitor | null = null

export function enableMonitoring(): void {
  if (monitor !== null) return
  monitor = createMonitor({ autoStart: false, exclude: ['/telemetry'] })
  monitor.start()
}

export function disableMonitoring(): void {
  monitor?.stop()
  monitor = null
}
```

Returning the monitor to `null` after `stop()` allows a later `enableMonitoring()` to create a
fresh, enabled monitor without tripping the single-monitor guard.

## Pitfalls

| Symptom                                        | Cause                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `INVALID_STATE` on the second StrictMode mount | The instance was created with `useMemo` and disposed in cleanup         |
| `useTracePulse()` returns `null`               | First render, or the component is outside the provider                  |
| Double reports in development                  | Two monitors (hot reload, or a module-level plus a component-level one) |
| Requests leak between users during SSR         | The monitor was imported into a server component or module scope        |
| Memory growth in long sessions                 | `maxHistory` left at the default and never cleared                      |

## Related documentation

- [Core concepts](../../docs/guide/core-concepts.md) — lifecycle and plugins.
- [Lifecycle control](../lifecycle.md) — deferred start and restart rules.
- [SSR and workers](../ssr.md) — the `typeof window` guard in context.

[⬅ Back to examples index](../README.md)
