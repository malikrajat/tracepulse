# Threshold evaluation (Step 7)

Internal, framework-agnostic classification of measured durations. The console reporter
used by `createMonitor()` consumes these results, but the evaluator itself is not exposed on
the package root.

`ThresholdConfig` stores explicit `warningMs` / `criticalMs` pairs for every
metric. `resolveConfig()` validates that each merged pair satisfies
`warningMs < criticalMs`, so `evaluateMeasurementThresholds()` can consume the
resolved `config.thresholds` directly. There is no derived warning ratio.

## Contract

```ts
evaluateThreshold(durationMs, warningThresholdMs, criticalThresholdMs)
```

| Duration                         | Result                                                  |
| -------------------------------- | ------------------------------------------------------- |
| below warning                    | `{ status: 'normal', durationMs }`                      |
| at/above warning, below critical | `{ status: 'warning', durationMs }`                     |
| at/above critical                | `{ status: 'critical', durationMs }`                    |
| `undefined`                      | `{ status: 'unavailable', reason: 'missing' }`          |
| negative/non-finite              | `{ status: 'unavailable', reason: 'invalid-duration' }` |

- Boundaries are inclusive for warning and critical.
- `0` is a measured duration, never a missing-value sentinel.
- Negative, `NaN` and `±Infinity` durations never become `normal`.
- Invalid _thresholds_ throw (`TypeError` / `RangeError`); invalid _data_ does
  not. Thresholds are validated before the duration is inspected.
- `warningMs < criticalMs` is required. Equal or inverted boundaries are
  rejected; a warning band must have positive width.
- Results are frozen. Inputs are never mutated.

## Metric mapping

```ts
evaluateMeasurementThresholds(measurement, thresholds)
```

| Config threshold       | Measurement metric | Formula                                     |
| ---------------------- | ------------------ | ------------------------------------------- |
| `queueMs`              | `queueMs`          | `sentAt - queuedAt`                         |
| `timeToResponseMs`     | `timeToResponseMs` | `responseStartedAt - (sentAt ?? startedAt)` |
| `responseProcessingMs` | `responseBodyMs`   | `responseCompletedAt - responseStartedAt`   |
| `uiUpdateMs`           | `uiUpdateMs`       | `uiTiming.updatedAt - completedAt`          |

The result is keyed by measurement metric (`queueMs`, `timeToResponseMs`,
`responseBodyMs`, `uiUpdateMs`), always with all four keys. Unavailable metrics stay present
as `unavailable` results.

## Availability today

| Measurement            | `queueMs`                           | `timeToResponseMs` | `responseBodyMs`                | `uiUpdateMs` |
| ---------------------- | ----------------------------------- | ------------------ | ------------------------------- | ------------ |
| fetch `completed`      | available                           | available; headers | unavailable                     | unavailable  |
| XHR `completed`        | `open()` → `send()`                 | `send()` → headers | available; headers → completion | unavailable  |
| XHR `headers-received` | available                           | available          | unavailable                     | unavailable  |
| pending                | available                           | unavailable        | unavailable                     | unavailable  |
| failed / aborted       | available when `completedAt` exists | unavailable        | unavailable                     |

- Fetch `durationMs` is **not** full response-download time; fetch resolves when
  headers are available. Step 8 must present it as **Time to response**, never as
  total request duration or full response download.
- XHR `responseBodyMs` is the transport's headers → completion interval (body
  transfer/completion), **not** application processing time.
- `uiUpdateMs` is the time from response availability (`responseStartedAt`) to an
  explicit UI-update point. A separate measurement point is required; this metric
  does not mean TracePulse measures UI updates automatically.
- `uiTiming` is never populated by fetch/XHR instrumentation. `uiUpdateMs` is
  classified only if an integration explicitly supplies it; otherwise it is
  unavailable. No render/paint time is inferred.

## Files

- `src/thresholds/evaluate-threshold.ts` — scalar evaluator and validation.
- `src/thresholds/evaluate-measurement.ts` — metric mapping and UI derivation.
- `src/thresholds/threshold.types.ts` — result and metric-evaluation contracts.
- `src/thresholds/index.ts` — internal barrel (not exported from `src/index.ts`).
