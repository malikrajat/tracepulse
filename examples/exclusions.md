# Example 2 — Excluding requests

Every application fires requests you never want to see: analytics beacons, session replay
uploads, health checks, third-party SDKs. `exclude` filters them out.

**Level:** beginner · **Concept:** URL exclusion rules · **Related:**
[Configuration](../docs/guide/configuration.md)

[⬅ Back to examples index](./README.md)

---

## Basic exclusion

```ts
import { createMonitor } from '@codewithrajat/tracepulse'

export const monitor = createMonitor({
  exclude: ['/telemetry', '/health', 'https://analytics.example.com', '/sentry'],
})
```

A request is excluded when its **resolved URL contains** one of the rules as a
**case-sensitive substring**. The full URL — query string and fragment included — takes part in
the match. Rules are plain strings, not globs or regular expressions.

| Rule                            | Matches                                                              | Does not match                         |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| `https://analytics.example.com` | `https://analytics.example.com/collect?e=view`                       | `https://cdn.example.com/analytics.js` |
| `/telemetry`                    | `https://app.test/telemetry/batch`                                   | `https://app.test/metrics`             |
| `/api/items`                    | `https://app.test/api/items?page=2`, `https://app.test/api/items-v2` | `https://app.test/api/item`            |

Because it is a substring test, `/telemetry` also matches `/telemetry-v2`. Add the trailing
slash (`/telemetry/`) when that matters.

## Excluding by origin

Relative calls are resolved against `document.baseURI` before matching, so an origin rule
works even when your code passes a relative path:

```ts
createMonitor({ exclude: ['https://api.partner.test'] })
```

## Building the list dynamically

The list is read **once**, when the monitor is created. Build it before that point:

```ts
const rules = ['/telemetry', '/health']

if (import.meta.env.DEV) {
  rules.push('/__vite_ping', '/mock-service-worker')
}

export const monitor = createMonitor({ exclude: rules })
```

`exclude` is copied into a fresh array, so mutating `rules` afterwards has no effect on the
monitor. Create a new monitor if the list must change.

## Exclusions do not replace configuration

`exclude` is **replaced**, never merged with the default (the default is `[]`). Passing
`exclude: ['/a']` means exactly one rule.

```ts
createMonitor({ exclude: [] }) // monitor everything
```

## Validation rules

- The value must be an array of strings.
- Every entry must be a non-empty, non-whitespace string — an empty string would exclude
  **everything**, so it is rejected at creation time.

```ts
createMonitor({ exclude: [''] })
// TypeError: config.exclude[0] must be a non-empty string
```

## Things to notice

- Excluded requests are forwarded untouched: no measurement, no console output, no wrapper
  overhead beyond the substring check.
- Exclusion happens on the way in, so an excluded request never appears even if it fails.
- TracePulse itself calls nothing; these rules describe **your** application's traffic only.
- Matching is case-sensitive: `/Telemetry` and `/telemetry` are different rules.

## Common mistakes

| Symptom                                     | Cause                                               |
| ------------------------------------------- | --------------------------------------------------- |
| A rule does not match                       | Case mismatch, or the rule is a glob/regex          |
| Too much is excluded                        | A short rule such as `/api` matches every API call  |
| Exclusions stop working after a config edit | The monitor was created before the list was mutated |

## Next

- [Thresholds](./thresholds.md) — make the requests you keep meaningful.
- [Lifecycle control](./lifecycle.md) — stop monitoring parts of the session entirely.

[⬅ Back to examples index](./README.md)
