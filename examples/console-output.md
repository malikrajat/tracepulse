# Example 4 — Console output

Exactly what TracePulse writes, what each field means, and how to keep a large session readable.

**Level:** intermediate · **Concept:** console reporter · **Related:**
[Configuration — console preferences](../docs/guide/configuration.md)

[⬅ Back to examples index](./README.md)

---

## Turning output down

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

// Summary only, no table, no colours.
export const monitor = createMonitor({
  console: { showTable: false, useColors: false },
})
```

| Option        | Default | Effect when `true` / `false`                                       |
| ------------- | ------- | ------------------------------------------------------------------ |
| `enabled`     | `true`  | `false`: reporter becomes a no-op; no console call at all          |
| `useColors`   | `true`  | `false`: headers and summary printed as plain text                 |
| `showTable`   | `true`  | `false`: no `console.table` row; summary still printed             |
| `collapsible` | `true`  | `false`: plain header line instead of a collapsible console group  |
| `replace`     | `false` | `true`: clears the console first, so one table updates in place    |
| `panel`       | `false` | `true`: one collapsed in-page panel; no console output at all      |
| `level`       | `"all"` | Minimum severity: `"all"`, `"warning"`, `"critical"` or `"off"`    |
| `onlyIssues`  | `false` | `true`: hides healthy requests; keeps everything that needs action |

`level` filters whole reports: `"warning"` hides healthy requests and `"critical"` shows only
breaches. Reports below the level are still accumulated for trends but never printed. A build
can set the default with `TRACEPULSE_LOG_LEVEL=warning pnpm build`; an explicit
`console.level` always wins.

`onlyIssues` is a separate pass/fail switch, so you can keep `level: 'all'` and still suppress
green requests:

```ts
createMonitor({ console: { onlyIssues: true } })
```

It prints warnings, criticals, failures, HTTP errors and `watch`/near-limit entries, and hides
only requests that are fully within their thresholds. Unlike `level: 'critical'`, a 4xx or an
abort (classified as a warning) stays visible. Both filters apply; the stricter one wins.
Hidden requests are still accumulated for trends, and exported reports always include every
measurement.

A production build usually wants:

```ts
createMonitor({ enabled: import.meta.env.DEV })
```

`enabled: false` also means the instrumentation still runs (with a no-op sink) if you created
the monitor with monitoring enabled. To remove the work entirely, do not create the monitor.

## One collapsed group per request

By default the reporter appends one **collapsed group** per terminal request. The console
therefore grows by one line per request, not by a full table that gets larger every time.
Expanding the group reveals that request's table row and the session summary.

```text
▶ TracePulse [WARNING] · GET app.test/api/items · 200 · Time to response 1240 ms (warning) · ↑ Time to response +80 ms
```

The header is always visible. A measured phase that increased since the previous sample of
the same endpoint is appended as a coloured `↑` delta, so a regression is visible without
expanding anything. `console.collapsible: false` prints the header as a plain line.

| Column             | Example                  | Notes                                                          |
| ------------------ | ------------------------ | -------------------------------------------------------------- |
| `Method`           | `GET`                    | Upper-cased                                                    |
| `URL`              | `https://app.test/api/x` | Resolved absolute URL                                          |
| `Transport`        | `fetch`                  | `fetch` or `xhr`                                               |
| `Status`           | `200`                    | `unavailable (status 0)` for an opaque `no-cors` response      |
| `Lifecycle`        | `completed`              | `completed`, `failed` or `aborted`                             |
| `Outcome`          | `success`                | `success`, `http-error`, `network-error`, `timeout`, `aborted` |
| `Queue`            | `2 ms (normal)`          | `sentAt - queuedAt`: wait before dispatch                      |
| `Time to response` | `120 ms (normal)`        | `responseStartedAt - sentAt`: dispatch → headers               |
| `Response body`    | `unavailable`            | Headers → transport completion (XHR only)                      |
| `UI render`        | `unavailable`            | Only when an explicit UI mark was supplied                     |
| `ID`               | `req_…_1`                | Unique per request                                             |

The four timing columns describe one continuous timeline, so they no longer overlap.

## One live panel instead of console entries

A browser console cannot remove or update a single entry: `console.clear()` is the only erase
API, and it also discards your application's own logs. A per-session table there therefore
either reprints a growing copy or wipes everything. `console.panel: true` avoids both — the
reporter appends one overlay to the page, keeps it collapsed, and replaces its content in
place after every request:

```ts
createMonitor({ console: { panel: true } })
```

Expanding the panel shows the session summary, the page report and one row per request
occurrence — a URL called five times gets five rows — with the same columns as the table
above plus `Severity` (the classification colour) and `Detail` (worst phase, near-limit
warning and `↑` deltas). The console stays completely untouched. In a runtime without a DOM
the reporter falls back to the console modes.

## Page load vs interaction-triggered requests

The reporter is **session-scoped**, not page-load-scoped. A `fetch()` fired by a button click,
a collapse/expand handler or any other event appends its own group when it terminates. The
summary inside each group groups by method + path, so the same endpoint stays one line
regardless of what triggered it.

A request is reported when it terminates, so interaction entries appear in the position they
happened, in call order. The reporter sees the request, not the DOM event, so the trigger is
not labelled; the group header's endpoint and the table row's `ID` identify it. A new
monitor — or a page reload — starts a new session.

## The summary block

A colour-coded block answers **what needs attention** across the session:

```text
TracePulse [CRITICAL] · 3 requests · 3 endpoints
  care now      GET app.test/api/report — 1 request · HTTP 500 (http-error), Time to response 5020 ms (critical)
  concern       POST app.test/api/checkout — 1 request · Time to response 1240 ms (warning)
  watch         GET app.test/api/items — 1 request · close to warning: Time to response 120 ms of 150 ms
```

| Section         | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `care now`      | Critical timing, HTTP 5xx, network failure or timeout.                |
| `concern`       | Warning timing, HTTP 4xx or an abort.                                 |
| `watch`         | Normal, but a phase is within 20% of its warning boundary.            |
| `not improving` | Later samples are consistently slower than the endpoint's first half. |
| `healthy`       | The rest; listed only when another section is present.                |

Rows are grouped by **method + path**, so a page-load request and an interaction-triggered
request (`?page=1` vs `?page=2`) share one endpoint line even though each request keeps its
own expandable group and row. The summary header shows the session's worst status plus how
many requests and endpoints the session holds. A healthy session prints:

```text
TracePulse [NORMAL] · 3 requests · 3 endpoints · nothing needs attention
```

## Classifications and colours

| Status        | Default colour | Colour applied?                      |
| ------------- | -------------- | ------------------------------------ |
| `normal`      | `#22c55e`      | yes                                  |
| `warning`     | `#eab308`      | yes                                  |
| `critical`    | `#ef4444`      | yes                                  |
| `unavailable` | —              | **never** — it must not look healthy |

```ts
createMonitor({
  colors: { normal: '#2c5', warning: '#f59e0b', critical: '#dc2626' },
})
```

Colours are hex only (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`); anything else throws a
`TypeError` at creation.

## "unavailable" is meaningful

| Text                     | Meaning                                                |
| ------------------------ | ------------------------------------------------------ |
| `unavailable`            | The metric was never measured                          |
| `unavailable (invalid)`  | A duration was supplied but was negative or non-finite |
| `unavailable (status 0)` | The response exposed no real HTTP status               |

Unavailable values are never rendered as `0`, and never classified as `normal`.

## Debugging a specific call

There is no public hook for raw measurements in V1, so the console is the interface. To
isolate one request, filter your own console by the request id, or wrap the call site:

```ts
console.log('before checkout')
await checkout()
console.log('after checkout')
```

The reporter ignores `pending` and `headers-received` snapshots, so a slow request prints
nothing until it terminates — silence on `before` means it is still in flight.

## Capturing output in a test

The reporter uses `console.groupCollapsed`, `console.table` and `console.log`, so each can be
asserted:

```ts
import { afterEach, expect, it, vi } from 'vitest'
import { createMonitor } from '@codewithrajat/tracepulse'

const table = vi.spyOn(console, 'table').mockImplementation(() => {})

afterEach(() => {
  vi.restoreAllMocks()
})

it('adds one table row for the request', async () => {
  const monitor = createMonitor()
  try {
    await fetch('data:text/plain,ok')
    expect(table).toHaveBeenCalledTimes(1)
    const rows = table.mock.calls.at(-1)?.[0] as unknown[]
    expect(rows).toHaveLength(1)
  } finally {
    monitor.stop()
  }
})
```

See [Testing](./testing.md) for the full pattern, including the single-monitor rule.

## Things to notice

- Table cells are never coloured individually; the group header and summary carry the colour,
  and every cell carries its status as text.
- A throwing `console` implementation cannot affect a request — every console call is isolated.
- Each terminal snapshot adds one collapsed group with one table row. Nothing reprints the
  growing session, so the console does not flood. Use `console.replace: true` when you want a
  literal single updating table instead, or `console.panel: true` to keep that table in an
  in-page panel and leave the console untouched.
- Duration increases over the previous sample of the same endpoint are highlighted in the
  group header, so a slowdown is visible while the group is still collapsed.
- No timestamps are printed; correlate with the browser's own console grouping if needed.
- The summary is grouped by endpoint, not by trigger: a page-load request and a button-click
  request to the same API share one line.

## Common mistakes

| Symptom                               | Cause                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| No output at all                      | `console.enabled: false`, `console.level: 'off'`, or monitoring `enabled: false`  |
| Healthy requests missing              | `console.level` is `"warning"` or `"critical"`; only flagged requests print       |
| Table without summary                 | `console.enabled: false` makes both disappear; `showTable` only affects the table |
| Everything looks green in screenshots | Colours are CSS `%c`; copying the line loses styling                              |
| `0 ms` shown as a duration            | Not possible from the reporter — `0` is a real measurement, not a missing one     |
| One collapsed line per request        | Expected: expand the group to see its row and the session summary                 |
| Want the old single-table view        | Set `console.replace: true`; it also clears your application's console output     |
| Repeated tables flooding the console  | `replace: true` reprints per request; use `panel: true` to update one overlay     |
| Panel missing in the browser          | `console.panel` defaults to `false`; opt in with `console: { panel: true }`       |

## Next

- [Lifecycle control](./lifecycle.md) — control when output happens.
- [Core events and plugins](./core-events.md) — move diagnostics into your own pipeline.

[⬅ Back to examples index](./README.md)
