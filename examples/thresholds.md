# Example 3 — Thresholds

Thresholds turn raw durations into `normal`, `warning` and `critical` classifications. This
page covers the four metric groups, how the merge works, and how to tune them per environment.

**Level:** intermediate · **Concept:** `warningMs` / `criticalMs` pairs · **Related:**
[Configuration — thresholds](../docs/guide/configuration.md)

[⬅ Back to examples index](./README.md)

---

## The four groups

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({
  thresholds: {
    queueMs: { warningMs: 100, criticalMs: 300 },
    timeToResponseMs: { warningMs: 1000, criticalMs: 2000 },
    responseProcessingMs: { warningMs: 200, criticalMs: 400 },
    uiUpdateMs: { warningMs: 400, criticalMs: 800 },
  },
})
```

| Group                  | Applied to            | Defaults `warningMs` / `criticalMs` | Available from     |
| ---------------------- | --------------------- | ----------------------------------- | ------------------ |
| `queueMs`              | Queue before dispatch | `100` / `300`                       | fetch and XHR      |
| `timeToResponseMs`     | Dispatch → headers    | `2000` / `3000`                     | fetch and XHR      |
| `responseProcessingMs` | Response body         | `300` / `500`                       | XHR only           |
| `uiUpdateMs`           | UI-render interval    | `500` / `1000`                      | explicit mark only |

> `uiUpdateMs` is configuration for a measurement point that does not exist yet. No transport
> populates `uiTiming`, so that row is always `unavailable`. Tuning it changes nothing today.

## The semantics

```text
0 ────────────── warningMs ────────────── criticalMs ──────────▶
     normal       │      warning          │      critical
```

- both boundaries are inclusive at their lower edge;
- `warningMs` must be **strictly less** than `criticalMs`;
- there is no formula deriving one from the other.

## Partial overrides keep the other boundary

Each boundary merges independently, so you only write what you want to change:

```ts
const config = resolveConfig({
  thresholds: { timeToResponseMs: { warningMs: 1500 } },
})

config.thresholds.timeToResponseMs.warningMs // 1500
config.thresholds.timeToResponseMs.criticalMs // 3000 — default preserved
```

The merged pair is validated **after** merging, so a valid-looking partial override cannot
cross the default boundary:

```ts
resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000 } } })
// RangeError: config.thresholds.timeToResponseMs.warningMs must be less than
// config.thresholds.timeToResponseMs.criticalMs, received 3000 and 3000
```

## Per-environment tuning

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const isProd = import.meta.env.PROD

export const monitor = createMonitor({
  thresholds: {
    // Production endpoints are slower and hit cold caches; be forgiving.
    timeToResponseMs: isProd
      ? { warningMs: 2500, criticalMs: 4000 }
      : { warningMs: 800, criticalMs: 1500 },
  },
})
```

## Tuning against reality

Do not tune to a guess. Measure first, then set the boundaries from the latency the application
already has:

1. Run with the defaults for a session and collect the observed `Queue`, `Time to response`,
   `Response body` and `UI render` values.
2. Set `warningMs` slightly above the typical value, and `criticalMs` where a user would notice.
3. Keep the ratio explicit rather than derived — the API deliberately refuses to compute one
   boundary from the other.

```ts
// Typical GET is ~120 ms; 400 ms is "slow", 800 ms is "something is wrong".
createMonitor({ thresholds: { timeToResponseMs: { warningMs: 400, criticalMs: 800 } } })
```

## Validation behaviour

| Input                                         | Result                                                |
| --------------------------------------------- | ----------------------------------------------------- |
| `{ warningMs: 0, criticalMs: 1 }`             | valid — `0` is a real boundary, not "unset"           |
| `{ warningMs: 500, criticalMs: 500 }`         | `RangeError` — equal boundaries leave no warning band |
| `{ warningMs: -1 }`                           | `RangeError` — must be `>= 0`                         |
| `{ warningMs: Number.NaN }`                   | `RangeError` — must be finite                         |
| `{ timeToResponseMs: 2000 }`                  | `TypeError` — the old single-number shape is rejected |
| `{ timeToResponseMs: { warningMs: 'fast' } }` | `TypeError` — must be a number                        |

Messages name the exact path, so the failing setting is always obvious.

## Things to notice

- Thresholds are read once, when the monitor is created; `stop()`/`start()` keeps them.
- The four groups are non-overlapping: queue, dispatch → headers, headers → completion, and
  completion → UI mark.
- `queueMs` is the application's own wait (XHR `open()` → `send()`, or the fetch hand-off), not
  the browser's internal connection queue.
- An HTTP error (404, 500) still gets classified; the outcome is `http-error`, and the
  summary calls it out separately from a duration breach.
- Thresholds never throw during a report: invalid _data_ yields `unavailable`, invalid
  _configuration_ throws at creation.

## Common mistakes

| Symptom                                 | Cause                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| Everything is `critical`                | Boundaries set for a different environment/device class |
| `uiUpdateMs` never shows a value        | No UI measurement exists in V1                          |
| `RangeError` at startup                 | `warningMs >= criticalMs` after merging with defaults   |
| `TypeError: ... must be a plain object` | Still using the pre-1.0 single-number shape             |

## Next

- [Console output](./console-output.md) — how classifications are displayed.
- [Lifecycle control](./lifecycle.md) — apply different configuration at different times.

[⬅ Back to examples index](./README.md)
