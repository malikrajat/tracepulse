# Reporting

TracePulse can hand you a **self-contained HTML report** (or JSON) that a teammate or a
manager can open without your application, your console or an account. The report is built
locally: no data leaves the page and no backend is involved.

Rendering is opt-in. The root entry keeps only a small bounded store and a snapshot method;
the HTML/JSON renderers live in a separate subpath.

```ts
import { createMonitor } from '@codewithrajat/tracepulse'
import {
  createHtmlReport,
  downloadHtmlReport,
  installReportShortcut,
} from '@codewithrajat/tracepulse/report'

const monitor = createMonitor({
  report: { maxEntries: 500 }, // the default
  ownership: {
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Frontend',
    failure: 'Network',
  },
})

// Download with the default Ctrl/Cmd+Shift+E shortcut (opt-in listener).
const uninstall = installReportShortcut(monitor, { title: 'Checkout latency' })

// …or export explicitly, for example from a button:
// const html = createHtmlReport(monitor.getReport(), { title: 'Checkout latency' })
// downloadHtmlReport(html, 'checkout-report.html')

// Later, when the feature or the page is torn down:
uninstall()
```

## What is retained

The monitor keeps the most recent **terminal** measurements — completed, failed or aborted
requests. Pending and headers-received snapshots are ignored.

| Setting             | Default | Meaning                                                      |
| ------------------- | ------- | ------------------------------------------------------------ |
| `report.enabled`    | `true`  | Retain measurements for export.                              |
| `report.maxEntries` | `500`   | Maximum retained measurements; the oldest are dropped first. |

Retention is independent of console reporting: `console.enabled: false` still records data
for a report. The store survives `stop()` and a later `start()`, so you can stop monitoring
and export afterwards. `monitor.clearMeasurements()` empties it without affecting the
console session or the lifecycle.

The store is bounded on purpose. A long session must not grow without a limit.

## Snapshot vs report

`monitor.getReport()` is deliberately thin. It returns a frozen `TracePulseReport`:

```ts
interface TracePulseReport {
  version: string
  generatedAt: number
  page: PageLoadMeasurement | undefined
  measurements: readonly RequestMeasurement[]
  settings: {
    thresholds: ThresholdConfig
    pageThresholds: PageThresholdConfig
    colors: ColorConfig
    ownership: OwnershipConfig
    hasOwners: boolean
  }
}
```

The settings are the values that were active when the snapshot was taken, so a later
`setThresholds()` does not rewrite an earlier snapshot.

Classification happens in the `/report` entry. `createReportView(snapshot)` returns the
classified `ReportView` (entries, severities, flagged stages, owners and summary) if you
need the data programmatically. The renderers call it for you.

```ts
import { createReportView } from '@codewithrajat/tracepulse/report'

const view = createReportView(monitor.getReport())

view.summary.bySeverity.critical // number
view.summary.byStage // flagged count + declared owner per phase
view.entries[0]?.severity // 'normal' | 'warning' | 'critical' | 'unavailable'
```

`generatedAt` defaults to `Date.now()`; pass an explicit value for deterministic output:

```ts
monitor.getReport({ generatedAt: 1_700_000_000_000 })
```

## The HTML report

`createHtmlReport(snapshot, { title? })` returns one complete HTML document as a string. It
contains inline CSS and a small vanilla script; it loads no fonts, images, scripts or
styles from the network.

The report includes:

- **Summary cards** — requests, critical, warning, failed and declared bytes.
- **Slow stages and responsible team** — flagged count and the declared owner for each
  phase, with its warning/critical bounds.
- **Owners** — request counts per declared owner. When no mapping is configured, the report
  says so and shows a copy-paste `ownership` example instead of inventing a team.
- **Page performance** — DOMContentLoaded, load, FCP, LCP, resource count and transfer
  bytes, classified against the page thresholds (when a page measurement exists).
- **Requests table** — severity, method, URL, transport, status, lifecycle, outcome, queue,
  time to response, response body, UI render, total duration, bytes, slow stage and owner.
- **Filters and sorting** — a search box, a severity filter, and sortable column headings.
  The table is server-rendered worst-first, so it is readable even before JavaScript runs.

Rows are sorted by severity and then total duration: critical first, then warning, normal
and unavailable. Clicking a heading sorts by that column; clicking again reverses it. Every
numeric column is sortable, including the four timing phases.

All application-controlled strings (URLs, methods, owner labels) are HTML-escaped. URLs are
rendered as text rather than links, so an unusual scheme cannot execute.

## Downloading

```ts
downloadHtmlReport(html, 'tracepulse-report.html')
```

This is an explicit call: it creates a Blob and a temporary `<a download>`, then revokes the
object URL. Without a filename it uses `tracepulse-report-<timestamp>.html`.

The library itself binds no DOM listener. If you want a keyboard shortcut, call the opt-in
installer:

```ts
const uninstall = installReportShortcut(monitor, {
  key: 'e', // default; combined with Ctrl/Cmd+Shift
  shiftKey: true,
  altKey: false,
  filename: 'tracepulse-report.html',
  title: 'Checkout latency',
})
```

The default is `Ctrl+Shift+E` (`Cmd+Shift+E` on macOS). The returned function removes the
listener. If you prefer your own binding, call the renderer and downloader directly:

```ts
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    downloadHtmlReport(createHtmlReport(monitor.getReport()))
  }
})
```

## JSON

```ts
import { createJsonReport } from '@codewithrajat/tracepulse/report'

const json = createJsonReport(monitor.getReport()) // pretty by default
const compact = createJsonReport(monitor.getReport(), { pretty: false })
```

The JSON is the classified view — the same severities, owners and rollups as the HTML
report — so a downstream tool does not need to re-run threshold logic.

## Runtimes

`createHtmlReport`, `createJsonReport` and `createReportView` are pure string/data
functions and work in Node, Deno, Bun and edge runtimes.

`downloadHtmlReport` and `installReportShortcut` require a DOM. Outside a browser they throw
a plain `Error` (`downloadHtmlReport requires a DOM environment` or
`installReportShortcut requires a DOM environment`). Render the HTML on the server, send it
to the browser, and download it there if needed.

## Privacy

A report contains only what the measurement model already holds: URL, method, transport,
timings, status, outcome, declared `Content-Length` and the owner labels you configured.
Bodies, headers and cookies are never captured. Generating, rendering and downloading a
report are local operations; nothing is uploaded.
