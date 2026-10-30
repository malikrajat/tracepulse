# Vanilla TypeScript example

A runnable Vite + TypeScript app that installs the request monitor, makes three requests and
exports the session as a self-contained HTML report. No framework, no backend.

**Level:** beginner · **Concept:** monitoring + report export · **Related:**
[Reporting](../../docs/guide/reporting.md) ·
[Configuration](../../docs/guide/configuration.md)

[⬅ Back to examples index](../README.md)

---

## Run it

From the repository root:

```bash
pnpm install
pnpm --filter @codewithrajat/tracepulse-example-vanilla-ts dev
```

Then open the printed URL. The three request buttons use a stubbed `fetch`, so no API server
is needed. Click a request, then **Export HTML** (or press `Ctrl`/`Cmd`+`Shift`+`E`).

Other scripts:

```bash
pnpm --filter @codewithrajat/tracepulse-example-vanilla-ts typecheck
pnpm --filter @codewithrajat/tracepulse-example-vanilla-ts build
pnpm --filter @codewithrajat/tracepulse-example-vanilla-ts preview
```

## What it demonstrates

```ts
import { createMonitor } from '@codewithrajat/tracepulse'
import {
  createHtmlReport,
  createJsonReport,
  createReportView,
  downloadHtmlReport,
  installReportShortcut,
} from '@codewithrajat/tracepulse/report'

const monitor = createMonitor({
  report: { maxEntries: 200 },
  ownership: {
    timeToResponseMs: 'Backend',
    serverError: 'Backend',
  },
})

// A bounded snapshot; no data leaves the page.
const html = createHtmlReport(monitor.getReport(), { title: 'Demo' })
downloadHtmlReport(html, 'demo.html')

// The same snapshot, classified, if you need the data directly.
const view = createReportView(monitor.getReport())
console.log(view.summary.bySeverity, view.summary.byOwner)

// The JSON export uses the same classified view.
const json = createJsonReport(monitor.getReport())
```

- **Fast request** — normal.
- **Slow request** — crosses the critical `timeToResponseMs` boundary; the report names the
  flagged stage and its declared owner.
- **Error request** — a 503 is escalated to critical even though it was fast.
- **Export HTML** — downloads one self-contained file with search, severity filtering,
  sortable timing columns, page data and the owner rollup.
- **Copy JSON** — shows the classified JSON and copies it when the clipboard is available.
- **Shortcut** — `installReportShortcut()` is opt-in; it returns an unsubscribe.

## How the imports resolve

The example imports the public package specifiers. `vite.config.ts` and `tsconfig.json`
alias them to `../../src`, so the example runs against the current source without a prior
library build. A real application installs `@codewithrajat/tracepulse` and uses the published
`dist/` entries; both specifiers are identical.

The `fetch` stub is installed **before** `createMonitor()`, so the instrumentation wraps the
stub. Replacing `fetch` after the monitor starts would bypass the wrapper.

## Privacy

The report contains URLs, methods, timings, statuses, outcomes, declared `Content-Length`
values and the owner labels configured here. Bodies, headers and cookies are not captured.
Rendering and downloading are local.
