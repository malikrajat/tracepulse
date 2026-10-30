# Vanilla JavaScript / TypeScript examples

No framework, no adapter, no build step required. This folder covers a Vite/TS app, a plain
`<script type="module">` page, and the IIFE build for a CDN-style `<script>` tag.

**Applies to:** any browser with ES2022 · **Related:**
[Getting started](../../docs/guide/getting-started.md)

[⬅ Back to examples index](../README.md)

---

## 1. Vite / TypeScript app

`src/telemetry.ts`

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({
  enabled: import.meta.env.DEV,
  exclude: ['/telemetry', '/health'],
  thresholds: { timeToResponseMs: { warningMs: 1000, criticalMs: 2000 } },
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => monitor.stop())
}
```

`src/main.ts`

```ts
import './telemetry'

document.querySelector('#load')?.addEventListener('click', async () => {
  const response = await fetch('/api/items')
  console.log('status', response.status)
})
```

That is the whole integration. Existing `fetch` and `XMLHttpRequest` calls need no changes.

## 2. Plain HTML, ES modules

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TracePulse demo</title>
  </head>
  <body>
    <button id="load" type="button">Load items</button>

    <script type="module">
      import { createMonitor } from './node_modules/@codewithrajat/tracepulse/dist/index.js'

      const monitor = createMonitor({ exclude: ['/telemetry'] })

      document.querySelector('#load').addEventListener('click', () => {
        fetch('/api/items')
      })

      window.addEventListener('pagehide', () => monitor.stop(), { once: true })
    </script>
  </body>
</html>
```

The `dist/index.js` path is literal because the package is not published yet; after `1.0.0`
ships you can import the bare specifier from a bundler or an import map.

## 3. IIFE build with a `<script>` tag

The IIFE bundle exposes `globalThis.TracePulse`:

```html
<script src="./node_modules/@codewithrajat/tracepulse/dist/index.iife.global.js"></script>
<script>
  const monitor = TracePulse.createMonitor({ exclude: ['/telemetry'] })

  fetch('/api/items') // reported to the console

  // Later:
  // monitor.stop()
</script>
```

Once published, the same file is available from a CDN:

```html
<!-- after the first npm publish -->
<script src="https://unpkg.com/@codewithrajat/tracepulse@1/dist/index.iife.global.js"></script>
```

## 4. A complete demo page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TracePulse playground</title>
  </head>
  <body>
    <h1>TracePulse</h1>
    <p>Open the console, then click a button.</p>

    <button id="fast" type="button">Fast request (~50 ms)</button>
    <button id="slow" type="button">Slow request (~1.2 s)</button>

    <script type="module">
      import { createMonitor } from './node_modules/@codewithrajat/tracepulse/dist/index.js'

      // Simulated endpoints: no server required. Stub first, then install the monitor
      // so the instrumentation wraps the stub instead of the native fetch.
      globalThis.fetch = async (input) => {
        const delay = String(input).includes('slow') ? 1200 : 50
        await new Promise((resolve) => setTimeout(resolve, delay))
        return new Response(null, { status: 200 })
      }

      createMonitor({ thresholds: { timeToResponseMs: { warningMs: 500, criticalMs: 1000 } } })

      document.querySelector('#fast').addEventListener('click', () => fetch('/fast'))
      document.querySelector('#slow').addEventListener('click', () => fetch('/slow'))
    </script>
  </body>
</html>
```

The slow request crosses both `warningMs` (500) and `criticalMs` (1000), so it prints a red
`CRITICAL` summary; the fast one prints a green `NORMAL` summary.

## 5. Recording your own events

```html
<script type="module">
  import { createTracePulse } from './node_modules/@codewithrajat/tracepulse/dist/index.js'

  const pulse = createTracePulse({ name: 'demo' })
  pulse.start()

  pulse.on('pulse', (event) => console.table([{ name: event.name, at: event.timestamp }]))

  document.addEventListener('click', (event) => {
    pulse.pulse('click', { tag: event.target?.tagName ?? 'unknown' })
  })
</script>
```

## Pitfalls

| Symptom                                             | Cause                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Uncaught SyntaxError: Cannot use import statement` | The script tag is missing `type="module"`                                    |
| `TracePulse is not defined`                         | Using the ESM bundle without a bundler, or the IIFE global before it loaded  |
| Two reports per request                             | Hot reload created a second monitor without stopping the first               |
| `fetch` stubbed for the demo stays stubbed          | Assigning `globalThis.fetch` replaces the wrapper's target — reload the page |

## Related documentation

- [Basic monitoring](../basic-monitoring.md) — what the console output means.
- [Console output](../console-output.md) — every field and option.
- [SSR and workers](../ssr.md) — workers and non-browser runtimes.

[⬅ Back to examples index](../README.md)
