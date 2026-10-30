# Examples

Copy-paste ready recipes for **TracePulse**. Every page here is runnable code you can drop
into a project, adjust and ship — the conceptual explanations live in
[`docs/`](../docs/guide/getting-started.md), this folder is about the code.

The [`vanilla-ts/`](./vanilla-ts/README.md) folder is a complete, compilable Vite package
you can run from this repository; the other pages are copy-paste recipes.

> **Not on npm yet.** `1.0.0` is unreleased, so install from the repository until the first
> publish:
>
> ```bash
> pnpm add file:../path/to/TracePulse        # local checkout
> # or, inside a pnpm workspace
> pnpm add "@codewithrajat/tracepulse@workspace:*"
> ```
>
> Every example imports from the package root, so switching to
> `pnpm add @codewithrajat/tracepulse` later requires no code change.

---

## How these examples are organised

```
Start here ──▶ basic-monitoring ──▶ exclusions ──▶ thresholds
                    │                    │             │
                    │                    │             └──▶ console-output
                    │                    └──▶ lifecycle ──▶ ssr
                    └──▶ core-events ──▶ testing
```

Framework folders sit alongside the language-agnostic pages. Each one contains a single
README with the recipes that matter for that framework, because TracePulse has **no framework
adapters** — you own the lifecycle, and each ecosystem does that differently.

## Framework-agnostic examples

| #   | Example                                     | Level        | What it demonstrates                                                            |
| --- | ------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| 1   | [Basic monitoring](./basic-monitoring.md)   | Beginner     | The smallest setup: one call, requests reported to the console.                 |
| 2   | [Excluding requests](./exclusions.md)       | Beginner     | Silencing analytics, health checks and third-party hosts.                       |
| 3   | [Thresholds](./thresholds.md)               | Intermediate | Tuning warning/critical boundaries per environment and per metric.              |
| 4   | [Console output](./console-output.md)       | Intermediate | Reading the table and summary; colours, tables and "unavailable".               |
| 5   | [Lifecycle control](./lifecycle.md)         | Intermediate | Deferred start, stop/restart, in-flight requests and the single-monitor rule.   |
| 6   | [Core events and plugins](./core-events.md) | Advanced     | `createTracePulse`, pulses, history, sampling and plugin teardown.              |
| 7   | [Testing](./testing.md)                     | Advanced     | Deterministic config, duration helpers and console assertions.                  |
| 8   | [SSR and workers](./ssr.md)                 | Advanced     | Import safety, platform guards and per-request instances.                       |
| 9   | [HTML and JSON reports](./report-export.md) | Advanced     | Self-contained exports, retention, search/sort, owners and the opt-in shortcut. |

## Framework examples

| Framework                | Folder                                | Covers                                                         |
| ------------------------ | ------------------------------------- | -------------------------------------------------------------- |
| React 18/19 (+ Next.js)  | [react/](./react/README.md)           | Context provider, StrictMode-safe instance, App Router guard.  |
| Angular 17+ (incl. SSR)  | [angular/](./angular/README.md)       | Root service, `provideAppInitializer`, `HttpClient`, zoneless. |
| Vue 3 (+ Nuxt 3)         | [vue/](./vue/README.md)               | Plugin install, composable, client-only guard.                 |
| Svelte 4/5 (+ SvelteKit) | [svelte/](./svelte/README.md)         | `onMount`, context, `browser` guard in a layout.               |
| Vanilla JS / TS          | [vanilla/](./vanilla/README.md)       | Module and IIFE/`<script>` usage, Vite HMR.                    |
| Vanilla TS (runnable)    | [vanilla-ts/](./vanilla-ts/README.md) | Compilable Vite app: monitor, report export, shortcut.         |
| Node / Deno / Bun        | [node/](./node/README.md)             | Why process-wide monitoring is risky; per-request instances.   |

## Shared conventions

All examples assume the library is installed and import from the package root:

```ts
import { createMonitor, createTracePulse } from '@codewithrajat/tracepulse'
```

Browser examples assume a `fetch`-capable environment. Nothing in the package sends data
anywhere, so no API key, endpoint or account is required.

The entries are deliberately separate:

| Entry point                        | Use it for                                             | Installs globals? |
| ---------------------------------- | ------------------------------------------------------ | ----------------- |
| `createMonitor()`                  | Automatic `fetch`/XHR timing and console diagnostics   | Yes               |
| `createTracePulse()`               | Your own application events (pulses), plugins, history | No                |
| `@codewithrajat/tracepulse/report` | Opt-in HTML/JSON rendering and download helpers        | No                |

## Running an example

1. Install the package as shown above.
2. Copy the snippet into a file that runs in the browser.
3. Load the page and make a request (`fetch('/api/items')` or any `XMLHttpRequest`).
4. Open the developer console — one collapsed group per terminal request; expand it to see
   the table row and the session summary.
5. Call `monitor.stop()` when you are done, or keep it running for the session.

## Common pitfalls across all frameworks

- **Only one monitor per loaded module instance.** A second `start()` throws `TracePulseError`
  with code `INVALID_STATE`. Stop the first monitor before starting another. Duplicate copies
  of the package are separate module instances and are not coordinated.
- **`enabled` is fixed at creation.** `createMonitor({ enabled: false })` can never start; make
  a new monitor instead.
- **`stop()` is not `cancel()`.** In-flight requests finish normally, they are just no longer
  reported.
- **The monitor patches the global `fetch`.** Create it in a browser-only code path, not during
  server rendering.
- **`uiUpdateMs` is inert in V1.** No transport populates `uiTiming`, so that threshold cannot
  fire. Do not tune it expecting render timing.

## Related documentation

- [Getting started](../docs/guide/getting-started.md) — the same content in ten lines.
- [Architecture](../docs/guide/architecture.md) — every parameter, default and contract.
- [Configuration](../docs/guide/configuration.md) — merge rules and validation.
- [API reference](../docs/guide/api.md) — every export and signature.

[⬅ Back to README](../README.md) · [Documentation](../docs/guide/getting-started.md)
