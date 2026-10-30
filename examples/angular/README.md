# Angular examples

TracePulse ships **no Angular library** — no `NgModule`, no DI token, no schematics. Because it
has no framework dependencies, it maps cleanly onto a root-provided service and an app
initializer.

**Applies to:** Angular 17+ (standalone) · **Related:**
[Architecture — framework integration](../../docs/guide/architecture.md)

[⬅ Back to examples index](../README.md)

---

## 1. Root service for the request monitor

```ts
// src/app/telemetry/trace-pulse.service.ts
import { DestroyRef, Injectable, inject, isDevMode, PLATFORM_ID } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { createMonitor, type Monitor } from '@codewithrajat/tracepulse'

@Injectable({ providedIn: 'root' })
export class TracePulseService {
  private readonly monitor: Monitor | null = null

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return // server render: never patch the process-wide fetch
    }

    this.monitor = createMonitor({
      enabled: isDevMode(),
      exclude: ['/telemetry', '/health'],
      thresholds: { timeToResponseMs: { warningMs: 1000, criticalMs: 2000 } },
    })

    inject(DestroyRef).onDestroy(() => this.monitor?.stop())
  }

  /** `true` while the monitor is installed in this realm. */
  get isMonitoring(): boolean {
    return this.monitor !== null
  }
}
```

`enabled` is fixed at creation, so this service either monitors for the whole application
lifetime or never does. To change the decision at runtime, `stop()` the monitor and construct a
new one (see [pitfalls](#pitfalls)).

Keep it `providedIn: 'root'`. A component-scoped copy creates a second monitor and its
`start()` throws `INVALID_STATE`.

## 2. Instantiate it eagerly

A root service is lazy: it is only constructed when something injects it. Force that at startup
with `provideAppInitializer` (Angular 19+) or `APP_INITIALIZER` (older):

```ts
// app.config.ts
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core'
import { TracePulseService } from './telemetry/trace-pulse.service'

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      inject(TracePulseService) // constructing it installs the monitor
    }),
  ],
}
```

Older Angular:

```ts
import { APP_INITIALIZER } from '@angular/core'
import { TracePulseService } from './telemetry/trace-pulse.service'

{
  provide: APP_INITIALIZER,
  multi: true,
  deps: [TracePulseService],
  useFactory: (service: TracePulseService) => () => {
    void service // listing it in `deps` constructs it, which installs the monitor
  },
}
```

Alternatively inject it into `AppComponent`:

```ts
@Component({ selector: 'app-root', template: '<router-outlet />' })
export class AppComponent {
  private readonly telemetry = inject(TracePulseService) // side effect: starts monitoring
}
```

## 3. `HttpClient` is covered automatically

`provideHttpClient()` uses `XMLHttpRequest` by default, and `provideHttpClient(withFetch())`
uses `fetch`. Both are instrumented by `createMonitor()` — no interceptor is required for
timing:

```ts
export class ItemsComponent {
  private readonly http = inject(HttpClient)

  readonly items$ = this.http.get<Item[]>('/api/items')
}
```

An interceptor is still the right tool if you need headers, retries or auth — the monitor only
observes.

## 4. Core instance as an injectable

For your own application events, wrap `createTracePulse` the same way:

```ts
import { DestroyRef, Injectable, inject } from '@angular/core'
import { createTracePulse, type TracePulse } from '@codewithrajat/tracepulse'

@Injectable({ providedIn: 'root' })
export class AppPulse {
  private readonly pulse: TracePulse = createTracePulse({ name: 'ng-app' })

  constructor() {
    this.pulse.start()
    inject(DestroyRef).onDestroy(() => this.pulse.dispose())
  }

  record(name: string, data?: Record<string, unknown>): void {
    this.pulse.pulse(name, data)
  }
}
```

```ts
export class CheckoutComponent {
  private readonly pulse = inject(AppPulse)

  pay(): void {
    this.pulse.record('checkout:submit', { step: 2 })
  }
}
```

## 5. Zoneless and SSR notes

- **Zoneless:** nothing to configure. The monitor never calls `ApplicationRef.tick()` and does
  not depend on Zone.js; it only measures and writes to the console.
- **SSR / prerender:** the `isPlatformBrowser` guard is required. Without it, the server-side
  build patches the process-wide `fetch` and reports other requests' traffic.
- **Hydration:** because monitoring starts in the service constructor (browser only), it does
  not affect hydration.

## Pitfalls

| Symptom                        | Cause                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| `INVALID_STATE` when starting  | Service provided in a component `providers` array, or two monitors |
| Nothing is reported            | Service never injected (it is lazy) — add an initializer           |
| Monitor runs during prerender  | Missing `isPlatformBrowser` guard; the patch is process-wide       |
| Business requests not measured | Requests made outside `fetch`/XHR, e.g. a custom transport         |

## Related documentation

- [Lifecycle control](../lifecycle.md) — stop/start and the single-monitor rule.
- [SSR and workers](../ssr.md) — platform guards for other frameworks.
- [API reference](../../docs/guide/api.md) — `createMonitor` and `Monitor`.

[⬅ Back to examples index](../README.md)
