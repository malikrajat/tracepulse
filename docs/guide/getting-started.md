# Getting started

## Requirements

|             |                                                                      |
| ----------- | -------------------------------------------------------------------- |
| Runtime     | Anything with ES2022 — Node 18+, modern browsers, Deno, Bun, workers |
| Development | Node `^22.18.0 \|\| ^24.11.0 \|\| >=26` (see `.nvmrc`) and pnpm `11` |
| TypeScript  | 4.7+ for consumers (published types are plain `.d.ts` / `.d.cts`)    |

## Install

```bash
pnpm add @codewithrajat/tracepulse
```

> **Not published yet.** `1.0.0` is prepared but unreleased, so this command fails until the
> first publish. Install from the repository in the meantime:
>
> ```bash
> pnpm add file:../path/to/TracePulse
> ```
>
> Every example imports from the package root, so switching to the published package later
> needs no code change.

## Your first instance

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

const pulse = createTracePulse({
  name: 'checkout',
  sampleRate: 0.25,
  maxHistory: 100,
})

const stopListening = pulse.on('pulse', (event) => {
  console.log(`[${event.timestamp}] ${event.name}`, event.data)
})

pulse.start()
pulse.pulse('cart:open', { items: 3 })

stopListening()
pulse.dispose()
```

`createTracePulse` is a thin alias for `new TracePulse(options)`. Both are exported;
use whichever reads better in your codebase.

## Monitor requests

`createMonitor()` installs fetch/XHR instrumentation and reports terminal request
measurements to the console. It starts automatically by default.

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({
  exclude: ['/telemetry'],
  autoStart: false,
})

monitor.start()
fetch('/api/items') // measured and reported

monitor.stop()
```

`start()` and `stop()` are idempotent. Only one monitor may run per loaded module instance;
duplicate package copies and separate realms are not coordinated. `stop()` does not remove a
third-party wrapper installed after TracePulse. See
[Configuration](/guide/configuration) for thresholds, colours and console output, or the
[API reference](/guide/api#request-monitoring) for the full lifecycle contract.

## Try it locally

This repository ships a framework-agnostic playground that imports the library
through its public entry point:

```bash
pnpm install
pnpm dev
```

The playground runs at `http://localhost:5173` with HMR. It demonstrates the
lifecycle, events, history, sampling and disposal without a build step.

## Everyday scripts

Everything runs through Vite+ — one CLI, one config file (`vite.config.ts`):

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `pnpm dev`           | `vp dev` — playground with HMR                        |
| `pnpm check`         | `vp check` — format, lint and type-check in one pass  |
| `pnpm check:fix`     | `vp check --fix` — format and autofix lint            |
| `pnpm test`          | `vp test run` — Vitest                                |
| `pnpm test:coverage` | Coverage with enforced thresholds                     |
| `pnpm test:browser`  | Real Chromium smoke test; skips without a browser     |
| `pnpm build`         | `vp pack` — ESM + CJS + IIFE and bundled declarations |
| `pnpm verify`        | Everything CI runs, in one command                    |

## Next steps

- [Configuration](/guide/configuration) — every setting, its default and validation rules.
- [Threshold pairs](/guide/migration) — the V1 schema and the unreleased numeric form.
- [Core concepts](/guide/core-concepts) — lifecycle, options, events, errors.
- [Plugins](/guide/plugins) — extend an instance without touching its internals.
- [API reference](/guide/api) — every export and its signature.
- [Publishing](/guide/publishing) — the prepared `1.0.0` release and every release after it.
