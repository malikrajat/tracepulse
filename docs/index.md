---
layout: home
description: Zero-dependency request monitoring and performance observability for JavaScript and TypeScript — fetch/XHR instrumentation, warning/critical thresholds, typed events and console reporting.

hero:
  name: TracePulse
  text: Request monitoring & performance observability
  tagline: Zero dependencies. Fetch/XHR instrumentation, warning/critical thresholds and console reporting for browsers, Node, Deno, Bun and edge runtimes.
  image:
    src: /logo.svg
    alt: TracePulse logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /guide/api

features:
  - title: Request monitoring
    details: Instruments fetch() and XMLHttpRequest, measures queue time, time to response and response-body time, and filters noisy endpoints with substring exclusions.
  - title: Warning and critical thresholds
    details: Classifies slow requests with typed per-metric thresholds and color-coded console groups — no backend, agent or dashboard required.
  - title: Framework-agnostic
    details: No Vue, React, DOM or Node.js APIs in the core. The same instance runs in browsers, workers, Node, Deno and edge runtimes.
  - title: Zero runtime dependencies
    details: The published package contains only your code — nothing to audit, patch or dedupe.
  - title: Strict by construction
    details: strict TypeScript, validated runtime options, stable error codes and a deterministic, injectable clock.
  - title: Publish-ready
    details: ESM + CJS + IIFE bundles, bundled .d.ts/.d.cts types, provenance-ready releases through Changesets.
---

## Install

```bash
pnpm add @codewithrajat/tracepulse
```

> **Not published yet.** `1.0.0` is prepared but unreleased. Until the first publish, install
> from the repository with `pnpm add file:../path/to/TracePulse`.

## Use

```ts
import { createTracePulse } from '@codewithrajat/tracepulse'

const pulse = createTracePulse({ name: 'app' })

pulse.on('pulse', (event) => console.log(event.name))
pulse.start()
pulse.pulse('render', { ms: 12 })
pulse.dispose()
```

Read the [core concepts](/guide/core-concepts) to understand the lifecycle, or jump
straight into [publishing](/guide/publishing) when you are ready to ship the first release.

## Support

Questions, integration help or private reports:
**[support@theraterajatmalik.dev](mailto:support@theraterajatmalik.dev)** ·
[GitHub issues](https://github.com/malikrajat/tracepulse/issues) ·
[npm package](https://www.npmjs.com/package/@codewithrajat/tracepulse).
