# Threshold pairs (V1)

TracePulse `1.0.0` is the first public release. There is no previously published TracePulse
API to migrate from. The finalized V1 configuration schema uses an explicit
`{ warningMs, criticalMs }` pair for every duration threshold.

During unreleased development, an earlier build accepted one number per category under
`requestDurationMs`, `responseProcessingMs` and `uiUpdateMs`. The final V1 schema renames
`requestDurationMs` to `timeToResponseMs` and requires an explicit `{ warningMs, criticalMs }`
pair for every category. The old key and the numeric form are **rejected** by `1.0.0`, not
reinterpreted, so a configuration cannot silently acquire different semantics. If you used
such a development build, translate it using the table and examples below. If you are starting
with the first public release, use the explicit pairs directly and skip the before/after
comparison.

## V1 defaults

| Category               | Default                                 |
| ---------------------- | --------------------------------------- |
| `queueMs`              | `{ warningMs: 100, criticalMs: 300 }`   |
| `timeToResponseMs`     | `{ warningMs: 2000, criticalMs: 3000 }` |
| `responseProcessingMs` | `{ warningMs: 300, criticalMs: 500 }`   |
| `uiUpdateMs`           | `{ warningMs: 500, criticalMs: 1000 }`  |

`queueMs` is new in this release, so the pre-release development build never had a matching
category; it keeps its default unless you override it.

A duration is classified as:

- **normal** — below `warningMs`;
- **warning** — at or above `warningMs`, but below `criticalMs`;
- **critical** — at or above `criticalMs`.

Boundaries must be finite and non-negative. `warningMs` must be strictly less than
`criticalMs`; equal boundaries are rejected because the warning band would have zero width.

## If you used a pre-release development build

| Category               | Pre-release numeric form (`requestDurationMs` etc.) | V1 form                                 |
| ---------------------- | --------------------------------------------------- | --------------------------------------- |
| `timeToResponseMs`     | `requestDurationMs: 3000`                           | `{ warningMs: 2000, criticalMs: 3000 }` |
| `responseProcessingMs` | `responseProcessingMs: 500`                         | `{ warningMs: 300, criticalMs: 500 }`   |
| `uiUpdateMs`           | `uiUpdateMs: 1000`                                  | `{ warningMs: 500, criticalMs: 1000 }`  |

Before (unreleased development build):

```ts
import { resolveConfig } from '@codewithrajat/tracepulse'

const config = resolveConfig({
  thresholds: {
    requestDurationMs: 2000,
    responseProcessingMs: 300,
    uiUpdateMs: 800,
  },
})
```

After (V1):

```ts
import { resolveConfig } from '@codewithrajat/tracepulse'

const config = resolveConfig({
  thresholds: {
    timeToResponseMs: { warningMs: 1500, criticalMs: 2500 },
    responseProcessingMs: { warningMs: 200, criticalMs: 400 },
    uiUpdateMs: { warningMs: 400, criticalMs: 800 },
  },
})
```

The development numbers were retained as the **critical** boundaries in the V1 defaults.
Warning boundaries were set earlier per category. If you need to keep a specific old
threshold as the critical boundary, choose a lower warning boundary:

```ts
import { resolveConfig } from '@codewithrajat/tracepulse'

const config = resolveConfig({
  thresholds: {
    timeToResponseMs: { warningMs: 2000, criticalMs: 3000 },
  },
})
```

## Partial overrides still merge

Only the boundaries you provide are overridden; the rest come from `DEFAULT_CONFIG`:

```ts
const config = resolveConfig({
  thresholds: { timeToResponseMs: { warningMs: 1500 } },
})

config.thresholds.timeToResponseMs.warningMs // 1500
config.thresholds.timeToResponseMs.criticalMs // 3000 (default preserved)
config.thresholds.responseProcessingMs.warningMs // 300 (default preserved)
```

The merged pair is validated after merging, so `{ warningMs: 4000 }` against the default
`criticalMs: 3000` fails with a `RangeError` instead of producing an invalid pair.

## `createMonitor()` configuration

`createMonitor()` accepts the same `MonitorConfigInput`:

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

const monitor = createMonitor({
  thresholds: {
    timeToResponseMs: { warningMs: 1000, criticalMs: 2000 },
    responseProcessingMs: { warningMs: 200, criticalMs: 400 },
  },
})
```

`enabled` is fixed at creation time in V1. Stop the current monitor before creating a
replacement if the setting must change.

## Error messages

The validation messages name the exact path:

```ts
resolveConfig({ thresholds: { requestDurationMs: 3000 } })
// TypeError: config.thresholds.requestDurationMs is no longer supported;
// use config.thresholds.timeToResponseMs with { warningMs, criticalMs }

resolveConfig({ thresholds: { timeToResponseMs: 2000 } })
// TypeError: config.thresholds.timeToResponseMs must be a plain object, received 2000

resolveConfig({ thresholds: { timeToResponseMs: { warningMs: 3000 } } })
// RangeError: config.thresholds.timeToResponseMs.warningMs must be less than
// config.thresholds.timeToResponseMs.criticalMs, received 3000 and 3000
```

See [Configuration](/guide/configuration#thresholds) for the complete semantics and
[API reference](/guide/api#configuration) for the public types.
