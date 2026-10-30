# Node / Deno / Bun examples

The library imports cleanly on every JavaScript runtime. The request **monitor**, however, was
designed for a browser realm: on a server it patches `globalThis.fetch` for the entire process,
which is shared by every concurrent request and every tenant.

**Applies to:** Node 18+, Deno, Bun, edge runtimes · **Related:**
[SSR and workers](../ssr.md)

[⬅ Back to examples index](../README.md)

---

## 1. Why not to create a monitor on the server

| Property of the monitor           | Consequence on a server                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| Patches `globalThis.fetch`        | Every request in the process is measured, including other tenants' |
| Reports to the shared console     | Interleaved output with no request correlation                     |
| Report carries no user/request id | You cannot attribute a line to the HTTP request that caused it     |
| One monitor per module instance   | Two workers/tenants fight over a single installation               |
| No exported measurement hook      | You cannot route the data into per-request logging in V1           |

If you need per-request timing on the server, measure where the request is owned — or use the
core instance per request, as below.

## 2. Per-request core instance (Express)

```ts
import express from 'express'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

declare global {
  namespace Express {
    interface Request {
      pulse: TracePulse
    }
  }
}

const app = express()

app.use((request, response, next) => {
  const pulse = createTracePulse({ name: 'http', maxHistory: 0 })

  pulse.start()
  pulse.on('pulse', (event) => {
    console.info(
      JSON.stringify({
        route: `${request.method} ${request.path}`,
        name: event.name,
        at: event.timestamp,
      }),
    )
  })

  request.pulse = pulse
  response.on('finish', () => pulse.dispose()) // terminal, idempotent

  next()
})

app.get('/items', async (request, response) => {
  request.pulse.pulse('route:enter', { path: request.path })

  const startedAt = performance.now()
  const items = await loadItems()

  request.pulse.pulse('db:items', { ms: Math.round(performance.now() - startedAt) })
  response.json(items)
})
```

`maxHistory: 0` is deliberate: on the server you want the events, not a retained buffer.

## 3. Per-request instance in a fetch handler

Runtimes with a web-standard `Request`/`Response` (Node 18+, Deno, Bun, Workers, Vercel Edge):

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

export default async function handler(request: Request): Promise<Response> {
  const pulse = createTracePulse({ name: 'edge' })

  try {
    pulse.start()
    pulse.pulse('request:start', { path: new URL(request.url).pathname })

    const response = await handle(request)

    pulse.pulse('request:end', { status: response.status })
    return response
  } finally {
    pulse.dispose()
  }
}
```

Keep the instance **inside** the handler. At module scope it would be shared by concurrent
invocations, and `dispose()` from one request would break the others.

## 4. A CLI or dev-only script

A single-tenant CLI has no concurrency problem, so a global monitor is defensible:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({
  enabled: process.env.NODE_ENV === 'development',
  exclude: ['/telemetry'],
})

// fetch is patched for this process only.
const response = await fetch('https://api.example.com/items')

monitor.stop()

if (!response.ok) {
  process.exitCode = 1
}
```

Node has no `XMLHttpRequest`, so only the fetch leg installs; the XHR installer returns a no-op.

## 5. Worker threads

`worker_threads` give each worker its own `globalThis`, so a monitor in a worker does not affect
the main thread — but it also reports to the worker's console:

```ts
// worker.mjs
import { parentPort } from 'node:worker_threads'
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({ enabled: true })

parentPort?.on('message', async () => {
  await fetch('https://api.example.com/items')
})

process.on('exit', () => monitor.stop())
```

## 6. Runtime notes

| Runtime        | Import | `createTracePulse` | `createMonitor`                |
| -------------- | ------ | ------------------ | ------------------------------ |
| Node 18+       | yes    | yes                | fetch only; process-wide patch |
| Deno           | yes    | yes                | fetch only; process-wide patch |
| Bun            | yes    | yes                | fetch only; process-wide patch |
| Edge / workers | yes    | yes                | fetch only; per-isolate patch  |

Relative URLs cannot be resolved without `document.baseURI`/`location.href`, so on the server
they are reported unchanged. Always pass absolute URLs to `fetch` in server code.

## Pitfalls

| Symptom                                    | Cause                                                                |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Another tenant's requests appear in a log  | Process-wide monitor on a shared server                              |
| All logs say the same instance is disposed | Instance created at module scope, disposed per request               |
| `XMLHttpRequest is not defined`            | Nothing to instrument — the XHR installer no-ops, it does not throw  |
| `INVALID_STATE` in a shutdown hook         | Another monitor is already running; stop it before starting this one |
| Relative URLs like `/api/items` in output  | No base URL outside the browser                                      |

## Related documentation

- [Core events and plugins](../core-events.md) — plugins, history, sampling.
- [SSR and workers](../ssr.md) — framework-specific guards.
- [Architecture](../../docs/guide/architecture.md) — the single-monitor invariant.

[⬅ Back to examples index](../README.md)
