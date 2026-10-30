# Example 8 — SSR and workers

TracePulse is safe to import anywhere. The monitor is only safe to **create** where a browser
`fetch`/XHR pair exists and a per-process patch is acceptable.

**Level:** advanced · **Concept:** environment guards · **Related:**
[Architecture — environments](../docs/guide/architecture.md)

[⬅ Back to examples index](./README.md)

---

## Importing is always safe

Import has no side effects:

- no globals are read at module evaluation;
- `VERSION` falls back to `0.0.0-dev` outside a build;
- the id fallback is guarded by `typeof`.

```ts
// safe on the server, in a worker, in Deno and Bun
import { createTracePulse, elapsedMs } from '@codewithrajat/tracepulse'
```

## The monitor is different

`createMonitor()` patches `globalThis.fetch` and `XMLHttpRequest.prototype` for the **whole
realm**:

| Environment    | `fetch` | `XMLHttpRequest` | Creating a monitor is…                                         |
| -------------- | ------- | ---------------- | -------------------------------------------------------------- |
| Browser        | yes     | yes              | intended                                                       |
| Web worker     | yes     | no               | works for fetch; relative URLs resolve against `location.href` |
| Node 18+ (SSR) | yes     | no               | **process-wide side effect** — avoid                           |
| Deno / Bun     | yes     | no               | same as Node                                                   |

In Node every concurrent request in the process shares the patch, so server-side monitoring
would mix tenants and leak across requests. Use [the Node example](./node/README.md) instead.

## Guard by framework

### Next.js (App Router)

```tsx
'use client'

import { useEffect } from 'react'

export function Telemetry() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let monitor: { stop(): void } | undefined

    void import('@codewithrajat/tracepulse').then(({ createMonitor }) => {
      monitor = createMonitor()
    })

    return () => monitor?.stop()
  }, [])

  return null
}
```

The `'use client'` directive keeps the file out of the server bundle; the `typeof window` check
covers prerendering. Never create the monitor at module scope in a file that the server also
imports.

### Angular

```ts
import { PLATFORM_ID, inject } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { createMonitor, type Monitor } from '@codewithrajat/tracepulse'

if (isPlatformBrowser(inject(PLATFORM_ID))) {
  createMonitor()
}
```

### SvelteKit

```ts
import { browser } from '$app/environment'
import { createMonitor } from '@codewithrajat/tracepulse'

if (browser) {
  createMonitor()
}
```

### Nuxt

```ts
// plugins/telemetry.client.ts — the `.client` suffix keeps it browser-only
import { createMonitor } from '@codewithrajat/tracepulse'

export default defineNuxtPlugin(() => {
  createMonitor()
})
```

## Per-request instances on the server

The core primitive is safe to use per request because it owns no globals:

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

export async function handler(request: Request): Promise<Response> {
  const pulse = createTracePulse({ name: 'request' })

  try {
    pulse.start()
    pulse.pulse('route:enter', { path: new URL(request.url).pathname })

    const result = await work(request)

    pulse.pulse('route:exit', { status: result.status })
    return result
  } finally {
    pulse.dispose() // always dispose: teardown + listener cleanup
  }
}
```

Do not create the instance at module scope — that would share history and listeners between
concurrent requests.

## Workers

In a worker there is no `document`, but `location.href` is used as the base URL, so relative
requests resolve against the worker script's URL. On server runtimes with neither a document
nor a location, relative URLs are reported unchanged rather than against a fabricated origin:

```ts
// worker.ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor() // fetch leg only; XHR installer is a no-op

self.addEventListener('message', () => {
  void fetch('https://api.test/items') // absolute URL: reported normally
})

self.addEventListener('close', () => monitor.stop())
```

## Things to notice

- When `fetch` is missing, the installer returns a no-op uninstall instead of throwing.
- When `XMLHttpRequest` (or `open`/`send`/`abort`) is missing, the XHR installer does the same.
- `stop()` restores only TracePulse's own wrappers; another library's patch is preserved.
- `createTracePulse()` works on every runtime, including edge functions, because it uses no
  DOM or Node APIs.

## Common mistakes

| Symptom                                         | Cause                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Requests from one user appear in another's logs | A process-wide monitor on the server                              |
| Relative URLs reported without an origin        | No `document.baseURI`/`location.href` (some server runtimes)      |
| Hydration mismatch warnings                     | Monitor started during render instead of an effect/lifecycle hook |

## Next

- [Framework folders](./README.md#framework-examples) — the concrete integration for your stack.
- [Lifecycle control](./lifecycle.md) — deferred start and shutdown.

[⬅ Back to examples index](./README.md)
