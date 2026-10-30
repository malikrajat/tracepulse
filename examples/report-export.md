# Example 9 — HTML and JSON reports

Export a session as one self-contained file that a teammate or a manager can open without
your console, your app or an account. Rendering is opt-in and lives in a separate subpath.

**Level:** advanced · **Concept:** report export · **Related:**
[Reporting](../docs/guide/reporting.md) ·
[Configuration — report retention](../docs/guide/configuration.md#report-retention)

[⬅ Back to examples index](./README.md)

---

## The smallest export

```ts
import { createMonitor } from '@codewithrajat/tracepulse'
import { createHtmlReport, downloadHtmlReport } from '@codewithrajat/tracepulse/report'

const monitor = createMonitor({
  ownership: {
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Frontend',
    failure: 'Network',
  },
})

// …let the application make requests…

const html = createHtmlReport(monitor.getReport(), { title: 'Checkout latency' })
downloadHtmlReport(html, 'checkout-latency.html')
```

The downloaded file is complete on its own: inline CSS and JavaScript, no fonts, images or
CDN requests. Opening it needs no network access.

## Retention

| Setting             | Default | Meaning                                                      |
| ------------------- | ------- | ------------------------------------------------------------ |
| `report.enabled`    | `true`  | Retain terminal measurements for export.                     |
| `report.maxEntries` | `500`   | Maximum retained measurements; the oldest are dropped first. |

Retention is independent of `console.enabled`, so this works:

```ts
const monitor = createMonitor({
  report: { maxEntries: 1000 },
  console: { enabled: false }, // no console noise, report still available
})
```

The store survives `stop()`/`start()`. To report only one flow, clear it at the boundary:

```ts
monitor.clearMeasurements()
await checkoutFlow()
downloadHtmlReport(createHtmlReport(monitor.getReport()), 'checkout.html')
```

## What is in the report

- Summary cards: requests, critical, warning, failed and declared bytes.
- Slow stages: flagged count, declared owner, warning/critical bounds per phase.
- Owners: request counts per declared owner, plus an unassigned count.
- Page performance: DOMContentLoaded, load, FCP, LCP, resource count and transfer bytes.
- Requests: every timing phase, total duration, bytes, severity, slow stage and owner.
- Search, a severity filter and sortable columns for every metric.

`getReport()` returns raw measurements plus the settings active at that moment. Classification
is available separately if you need it:

```ts
import { createReportView } from '@codewithrajat/tracepulse/report'

const view = createReportView(monitor.getReport())
view.summary.byOwner // [{ owner: 'Backend', count: 3 }, …]
```

## Keyboard shortcut

`installReportShortcut()` is opt-in and binds exactly one listener. It returns an unsubscribe.

```ts
import { installReportShortcut } from '@codewithrajat/tracepulse/report'

const uninstall = installReportShortcut(monitor, {
  title: 'Checkout latency',
  filename: 'checkout-latency.html',
})

// Ctrl+Shift+E or Cmd+Shift+E downloads the current report.

// On teardown:
uninstall()
```

If you already own a shortcut system, call the renderer and downloader directly — nothing is
hidden:

```ts
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    downloadHtmlReport(createHtmlReport(monitor.getReport()))
  }
})
```

## JSON instead of HTML

```ts
import { createJsonReport } from '@codewithrajat/tracepulse/report'

const json = createJsonReport(monitor.getReport()) // classified view, pretty-printed
const compact = createJsonReport(monitor.getReport(), { pretty: false })
```

## Node and SSR

`createHtmlReport`, `createJsonReport` and `createReportView` are pure and work on the server.
`downloadHtmlReport` and `installReportShortcut` require a DOM and throw a plain `Error`
elsewhere, so render on the server and download in the browser.

## Privacy

The report contains URLs, methods, timings, statuses, outcomes, declared `Content-Length`
values and the owner labels you declared. Bodies, headers and cookies are never captured.
Nothing is uploaded: rendering and downloading are local operations.
