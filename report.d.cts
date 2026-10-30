//#region src/config/config.types.d.ts
/**
 * Public configuration types for the browser API monitor.
 *
 * The configuration is deliberately framework-agnostic: it contains only plain
 * data (booleans, numbers, strings and arrays), so the same object can be built
 * in React, Angular, Vue, Svelte or vanilla JavaScript.
 *
 * Nothing in this module performs monitoring, timing or reporting — it only
 * describes *how* the request monitor should behave.
 */
/**
 * A CSS hex color string.
 *
 * Supported formats (validated at runtime): `#rgb`, `#rgba`, `#rrggbb` and
 * `#rrggbbaa`.
 */
type ColorValue = string;
/**
 * Warning and critical boundaries for one duration category, in milliseconds.
 *
 * A duration is:
 * - `normal` when it is below `warningMs`;
 * - `warning` when it is at least `warningMs` but below `criticalMs`;
 * - `critical` when it is at least `criticalMs`.
 *
 * Both boundaries are inclusive, but `warningMs` must be **strictly less** than
 * `criticalMs`. Equal boundaries are rejected during configuration validation:
 * they would leave a warning band with zero width and make the status
 * ambiguous for V1.
 */
interface DurationThreshold {
  /**
   * Duration at or above which a measurement becomes a warning, in
   * milliseconds.
   */
  warningMs: number;
  /**
   * Duration at or above which a measurement becomes critical, in milliseconds.
   */
  criticalMs: number;
}
/**
 * Warning and critical duration boundaries per measurement category, in
 * milliseconds.
 *
 * These are configurable defaults, not universal performance standards. Tune
 * them per application and per device class.
 *
 * @remarks
 * `warningMs` and `criticalMs` are stored explicitly for every category. There
 * is deliberately no formula that derives one from the other.
 */
interface ThresholdConfig {
  /**
   * Boundaries for the time a request waited before it was dispatched.
   *
   * For `XMLHttpRequest` this is the interval between `open()` and `send()`: how
   * long the application held the request before handing it to the browser. For
   * `fetch()` it is the short interval between the call and the native transport
   * accepting it. A queue duration is only reported where a dispatch boundary
   * was observed; it is never inferred.
   *
   * @default { warningMs: 100, criticalMs: 300 }
   */
  queueMs: DurationThreshold;
  /**
   * Boundaries for the wait between dispatch and response headers.
   *
   * The response phase starts when the transport accepted the request
   * (`sentAt`), so it excludes the queue. For `fetch`, the observed lifecycle
   * ends when headers are available, which is exactly this phase. For XHR it is
   * the header boundary before the body interval.
   *
   * @default { warningMs: 2000, criticalMs: 3000 }
   */
  timeToResponseMs: DurationThreshold;
  /**
   * Boundaries for the observed response-body duration, where that is
   * measurable.
   *
   * For XHR this is the interval between response headers and the transport's
   * completion event (body transfer/completion), not application processing
   * time. Fetch instrumentation does not observe body completion, so this
   * measurement is unavailable for fetch.
   *
   * @default { warningMs: 300, criticalMs: 500 }
   */
  responseProcessingMs: DurationThreshold;
  /**
   * Boundaries for the time between the observed request completing and a
   * defined UI-update measurement point.
   *
   * @remarks
   * UI updates cannot be measured accurately for every framework without a
   * clearly defined measurement boundary (for example an explicit mark after a
   * render, or an optional framework adapter). This setting only defines the
   * limits; it does not make render timing possible by itself. Fetch and XHR
   * instrumentation do not measure UI updates automatically.
   *
   * @default { warningMs: 500, criticalMs: 1000 }
   */
  uiUpdateMs: DurationThreshold;
}
/**
 * Colors used by the console reporter when it renders a measurement.
 *
 * Colors are independent from {@link ThresholdConfig}: a threshold decides
 * *which* status applies, a color decides *how* that status is styled.
 */
interface ColorConfig {
  /**
   * Color for measurements within their thresholds.
   *
   * @default "#22c55e" (green)
   */
  normal: ColorValue;
  /**
   * Color for measurements that exceed a warning boundary.
   *
   * @default "#eab308" (yellow)
   */
  warning: ColorValue;
  /**
   * Color for measurements that exceed a critical boundary.
   *
   * @default "#ef4444" (red)
   */
  critical: ColorValue;
}
/**
 * Declared owners for each flagged phase and failure class.
 *
 * TracePulse classifies *what* is slow, not *who* owns it: the same phase can
 * belong to different teams in different applications, and the library cannot
 * prove ownership from timings alone. This mapping is therefore explicit input,
 * never inferred.
 *
 * Every owner is an arbitrary, short label (for example `"Frontend"`,
 * `"Backend"`, `"API contract"`, `"Network"`). When a phase breaches its
 * threshold, the reporter renders the matching owner next to the flagged
 * phase. Labels are only shown for measurements that need attention.
 *
 * Status-based entries take precedence over phase entries, because a failed
 * request or an error status needs the owning team regardless of which phase
 * was slowest.
 *
 * @example
 * ```ts
 * resolveConfig({
 *   ownership: {
 *     queueMs: 'Frontend',
 *     timeToResponseMs: 'Backend',
 *     responseProcessingMs: 'Backend',
 *     uiUpdateMs: 'Frontend',
 *     serverError: 'Backend',
 *     clientError: 'API contract',
 *     failure: 'Network',
 *   },
 * })
 * ```
 */
interface OwnershipConfig {
  /**
   * Owner of the queue phase (`sentAt - queuedAt`).
   *
   * For XHR this is the application's `open()` → `send()` wait, so a breach
   * usually points at client code. For fetch it is the short call → native
   * hand-off interval and is rarely actionable.
   *
   * @default undefined (no owner label)
   */
  queueMs?: string | undefined;
  /**
   * Owner of the response phase (`dispatch → headers`).
   *
   * This interval includes network and server time, so a label such as
   * `"Backend"` is a declared responsibility, not a measurement result.
   *
   * @default undefined (no owner label)
   */
  timeToResponseMs?: string | undefined;
  /**
   * Owner of the response-body phase (`headers → transport completion`).
   *
   * @default undefined (no owner label)
   */
  responseProcessingMs?: string | undefined;
  /**
   * Owner of an explicitly supplied UI-update interval.
   *
   * @default undefined (no owner label)
   */
  uiUpdateMs?: string | undefined;
  /**
   * Owner of a response with status `500`–`599`.
   *
   * @default undefined (no owner label)
   */
  serverError?: string | undefined;
  /**
   * Owner of a response with a non-2xx status below `500` (for example `404`).
   *
   * An opaque `status: 0` response has no usable status, so it does not match
   * this entry.
   *
   * @default undefined (no owner label)
   */
  clientError?: string | undefined;
  /**
   * Owner of a request that failed without a usable response
   * (`network-error` or client-side `timeout`).
   *
   * An abort is not mapped here: it may be intentional, so it is classified as
   * a warning and left to the phase mapping.
   *
   * @default undefined (no owner label)
   */
  failure?: string | undefined;
}
/**
 * Warning and critical boundaries for page-level metrics, in milliseconds.
 *
 * These are defaults, not universal standards. `pageLoadMs` measures the
 * initial document from navigation start to `load`; the paint metrics measure
 * from navigation start to that paint. A soft-navigation segment has no
 * browser load boundary, so none of these metrics apply to it.
 */
interface PageThresholdConfig {
  /**
   * Total page load: navigation start → window `load` event.
   *
   * @default { warningMs: 3000, criticalMs: 5000 }
   */
  pageLoadMs: DurationThreshold;
  /**
   * First Contentful Paint.
   *
   * @default { warningMs: 1800, criticalMs: 3000 }
   */
  firstContentfulPaintMs: DurationThreshold;
  /**
   * Largest Contentful Paint observed at capture time.
   *
   * @default { warningMs: 2500, criticalMs: 4000 }
   */
  largestContentfulPaintMs: DurationThreshold;
  /**
   * Time from navigation start until the page became stable.
   *
   * Stability is the end of the last observed network activity burst, confirmed
   * by a `page.idleMs` quiet window. A snapshot taken before that window
   * completed has no stable duration and is reported as unavailable.
   *
   * @default { warningMs: 4000, criticalMs: 8000 }
   */
  pageStableMs: DurationThreshold;
}
/**
 * Partial overrides for one {@link DurationThreshold}.
 *
 * Declared explicitly (instead of `Partial<DurationThreshold>`) so that
 * `exactOptionalPropertyTypes` users can also pass an explicit `undefined`,
 * which behaves like "not provided". Each boundary is merged independently, so
 * overriding `warningMs` keeps the default `criticalMs`.
 */
interface DurationThresholdInput {
  /** @see DurationThreshold.warningMs */
  warningMs?: number | undefined;
  /** @see DurationThreshold.criticalMs */
  criticalMs?: number | undefined;
}
/**
 * Partial overrides for {@link ThresholdConfig}.
 *
 * Declared explicitly (instead of `Partial<ThresholdConfig>`) so that
 * `exactOptionalPropertyTypes` users can also pass an explicit `undefined`,
 * which behaves like "not provided".
 */
interface ThresholdConfigInput {
  /** @see ThresholdConfig.queueMs */
  queueMs?: DurationThresholdInput | undefined;
  /** @see ThresholdConfig.timeToResponseMs */
  timeToResponseMs?: DurationThresholdInput | undefined;
  /** @see ThresholdConfig.responseProcessingMs */
  responseProcessingMs?: DurationThresholdInput | undefined;
  /** @see ThresholdConfig.uiUpdateMs */
  uiUpdateMs?: DurationThresholdInput | undefined;
}
//#endregion
//#region src/models/request-measurement.types.d.ts
/**
 * The common measurement model for monitored browser requests.
 *
 * This module is intentionally **types only**. It contains no interception,
 * timestamp collection, filtering or reporting logic, so the same model can be
 * produced by `fetch()` instrumentation or by `XMLHttpRequest` instrumentation
 * without coupling either transport to the other.
 *
 * All timestamps come from one clock function per measurement (see
 * {@link MonotonicTimestamp}); a measurement never mixes clock domains.
 */
/**
 * Milliseconds on the instrumentation clock, normally `performance.now()`.
 *
 * `performance.now()` is preferred because it is monotonic: elapsed durations
 * computed from it do not jump when the system clock changes. A `Date.now()`
 * fallback is used only when `performance` is unavailable; wall-clock and
 * high-resolution values must not be mixed into the same measurement.
 *
 * Durations are not stored redundantly; derive them from timestamps with
 * `getRequestDurations()` or `elapsedMs()`:
 *
 * - `queueMs = sentAt - queuedAt` — how long the request waited before dispatch
 * - `timeToResponseMs = responseStartedAt - (sentAt ?? startedAt)` — wait for headers
 * - `responseBodyMs = responseCompletedAt - responseStartedAt` — body transfer
 * - `durationMs = completedAt - (queuedAt ?? startedAt)` — observed total
 *
 * A duration exists only when both of its timestamps exist; helpers return
 * `undefined` rather than a fabricated value.
 */
type MonotonicTimestamp = number;
/**
 * Opaque identifier for one observed request.
 *
 * Generated per request — never derived from the URL alone. Two concurrent
 * requests to the same URL must have different ids.
 */
type RequestId = string;
/** Which browser API produced the measurement. */
type RequestTransport = 'fetch' | 'xhr';
/**
 * HTTP method, upper-cased.
 *
 * Common methods are listed for autocomplete; custom methods are allowed.
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | (string & {});
/**
 * When each observable moment of the request lifecycle happened.
 *
 * Missing values are represented by `undefined`, never by `0`. `0` is a valid
 * timestamp on a monotonic clock and therefore must not be used as a
 * "no measurement" sentinel.
 *
 * @remarks
 * `fetch` resolves when headers are available; the body may be consumed later
 * and the library never reads it just to measure it. `responseCompletedAt` is
 * therefore only set when completion is observable without consuming the body.
 * XHR instrumentation can set it from the corresponding completion event.
 */
interface RequestTiming {
  /** When the library began observing the request. Always available. */
  readonly startedAt: MonotonicTimestamp;
  /**
   * When the request entered the client-side queue, before it was dispatched.
   *
   * For `XMLHttpRequest` this is the moment `open()` completed; the application
   * may hold the request there before calling `send()`. For `fetch()` it is the
   * moment the call was observed, because the browser dispatches it immediately.
   * Absent only for measurements that do not record a queue boundary.
   */
  readonly queuedAt?: MonotonicTimestamp | undefined;
  /**
   * When the request was handed to the transport.
   *
   * For `XMLHttpRequest` this is `send()`. For `fetch()` it is the moment the
   * native call accepted the request. Absent when dispatch was never observed
   * (for example a synchronous throw before the transport ran).
   */
  readonly sentAt?: MonotonicTimestamp | undefined;
  /**
   * When response headers (or the equivalent response-start event) became
   * available. Absent when the request failed or was aborted before that point.
   */
  readonly responseStartedAt?: MonotonicTimestamp | undefined;
  /**
   * When the response body was fully consumed, or the transport's completion
   * event fired. Absent when this is not observable.
   */
  readonly responseCompletedAt?: MonotonicTimestamp | undefined;
  /**
   * When the library considered the observed lifecycle finished — the moment of
   * completion, failure or abort. Absent while the request is still in flight.
   */
  readonly completedAt?: MonotonicTimestamp | undefined;
}
/**
 * Response metadata captured from the transport.
 *
 * This is metadata only. Response bodies, request bodies, cookies, authorization
 * headers and other sensitive payloads are deliberately not part of the model.
 */
interface ResponseMetadata {
  /**
   * HTTP status code. For opaque `no-cors` fetch responses this may be `0`.
   */
  readonly status: number;
  /**
   * Whether the transport considered the response successful (HTTP 2xx).
   *
   * Mirrors `Response.ok`; it is captured rather than derived because opaque
   * responses report `status: 0` and `ok: false`.
   */
  readonly ok: boolean;
  /** HTTP status text, when the transport exposes it. */
  readonly statusText?: string | undefined;
  /** Value of the `Content-Type` header, when available. */
  readonly contentType?: string | undefined;
  /**
   * Declared response size in bytes, when available and trustworthy.
   *
   * `Content-Length` can be absent (chunked responses) or describe the compressed
   * size, so this must not be treated as an exact decoded body length.
   */
  readonly contentLength?: number | undefined;
}
/** The HTTP exchange completed with a 2xx status. */
interface SuccessOutcome {
  readonly kind: 'success';
}
/**
 * The HTTP exchange completed, but the status was not 2xx (for example 404, 500,
 * 408 or 504).
 *
 * This is **not** a network failure: the response was received and the status
 * code is available in {@link ResponseMetadata.status}.
 */
interface HttpErrorOutcome {
  readonly kind: 'http-error';
}
/**
 * The request failed before a usable HTTP response was received (DNS, TLS,
 * connection, CORS or similar transport-level failure).
 *
 * HTTP error statuses such as 404 or 500 do **not** use this outcome.
 */
interface NetworkErrorOutcome {
  readonly kind: 'network-error';
  /**
   * Best-effort error message for display.
   *
   * The original error object is intentionally not stored, so measurements stay
   * plain, serialisable data and cannot retain request/response internals.
   */
  readonly message?: string | undefined;
}
/**
 * The library stopped waiting for the request because a timeout elapsed.
 *
 * This is a client-side timeout. An HTTP 408 or 504 response is an
 * {@link HttpErrorOutcome}, because a response was actually received.
 */
interface TimeoutOutcome {
  readonly kind: 'timeout';
}
/** The request was cancelled, for example through `AbortController`. */
interface AbortedOutcome {
  readonly kind: 'aborted';
  /** Optional human-readable reason supplied by the caller or transport. */
  readonly reason?: string | undefined;
}
/** Every possible final outcome of an observed request. */
type RequestOutcome = SuccessOutcome | HttpErrorOutcome | NetworkErrorOutcome | TimeoutOutcome | AbortedOutcome;
/** Outcomes that can finish the `completed` state (a response was received). */
type CompletedRequestOutcome = SuccessOutcome | HttpErrorOutcome;
/** Outcomes that can finish the `failed` state (no usable response required). */
type FailedRequestOutcome = NetworkErrorOutcome | TimeoutOutcome;
/**
 * States that cannot change any further.
 *
 * `pending` and `headers-received` are still in flight; the others are final.
 */
type TerminalRequestLifecycleState = 'completed' | 'failed' | 'aborted';
/**
 * Optional UI-side measurement, deliberately separate from transport timing.
 *
 * `responseCompletedAt` is **not** a render or paint timestamp. This type is only
 * populated when an explicit UI-update boundary is supplied by an integration or
 * by application code; otherwise it is absent.
 */
interface UiTiming {
  /** Monotonic timestamp of the explicitly marked UI update. */
  readonly updatedAt: MonotonicTimestamp;
}
/** Fields shared by every lifecycle state. */
interface RequestMeasurementBase {
  /** Unique per request, including concurrent requests to the same URL. */
  readonly id: RequestId;
  /**
   * The requested URL. Instrumentation should resolve relative input against the
   * document base URL when possible, so measurements are comparable.
   */
  readonly url: string;
  /** Upper-cased HTTP method. */
  readonly method: HttpMethod;
  /** Browser API that produced this measurement. */
  readonly transport: RequestTransport;
  /** Observed timing. Only `startedAt` is guaranteed. */
  readonly timing: RequestTiming;
}
/**
 * The request has started and no response metadata is available yet.
 */
interface PendingRequestMeasurement extends RequestMeasurementBase {
  readonly lifecycle: 'pending';
  readonly response?: undefined;
  readonly outcome?: undefined;
}
/**
 * Response headers are available, but the response body may still be processing.
 *
 * A finished body does not automatically move the measurement to `completed`;
 * the transport integration decides when the observed lifecycle ends.
 */
interface HeadersReceivedRequestMeasurement extends RequestMeasurementBase {
  readonly lifecycle: 'headers-received';
  readonly response: ResponseMetadata;
  readonly outcome?: undefined;
}
/**
 * The observed request lifecycle finished with an HTTP response.
 *
 * The response may be a 2xx ({@link SuccessOutcome}) or any other status
 * ({@link HttpErrorOutcome}); both are `completed`, never `failed`.
 */
interface CompletedRequestMeasurement extends RequestMeasurementBase {
  readonly lifecycle: 'completed';
  readonly response: ResponseMetadata;
  readonly outcome: CompletedRequestOutcome;
  /** Present only when a UI update was explicitly marked. */
  readonly uiTiming?: UiTiming | undefined;
}
/**
 * The request did not complete normally: a network failure or a client-side
 * timeout.
 *
 * `response` is present only when headers had already been received before the
 * failure (for example a connection reset while reading the body).
 */
interface FailedRequestMeasurement extends RequestMeasurementBase {
  readonly lifecycle: 'failed';
  readonly response?: ResponseMetadata | undefined;
  readonly outcome: FailedRequestOutcome;
}
/**
 * The request was cancelled.
 *
 * `response` is present when the abort happened after headers were received.
 */
interface AbortedRequestMeasurement extends RequestMeasurementBase {
  readonly lifecycle: 'aborted';
  readonly response?: ResponseMetadata | undefined;
  readonly outcome: AbortedOutcome;
}
/**
 * A monitored request in any lifecycle state.
 *
 * Discriminate on `lifecycle` to narrow which fields are available.
 *
 * @example
 * ```ts
 * function statusText(measurement: RequestMeasurement): string {
 *   switch (measurement.lifecycle) {
 *     case 'completed':
 *       return `${measurement.response.status} (${measurement.outcome.kind})`
 *     case 'failed':
 *       return measurement.outcome.kind
 *     case 'aborted':
 *       return 'aborted'
 *     default:
 *       return 'in flight'
 *   }
 * }
 * ```
 */
type RequestMeasurement = PendingRequestMeasurement | HeadersReceivedRequestMeasurement | CompletedRequestMeasurement | FailedRequestMeasurement | AbortedRequestMeasurement;
//#endregion
//#region src/models/request-timing.d.ts
/**
 * A non-negative elapsed duration, in milliseconds.
 *
 * Durations are derived from monotonic timestamps; they are never wall-clock
 * values and are never stored redundantly on a measurement.
 */
type DurationMs = number;
//#endregion
//#region src/models/api-totals.d.ts
/** Aggregate network time for the observed requests. */
interface ApiTotals {
  /** Measurements that were considered, whether or not they were measurable. */
  readonly requests: number;
  /** Measurements that contributed an interval to the totals. */
  readonly measured: number;
  /**
   * Total time at least one request was in flight, in milliseconds.
   *
   * Overlapping requests are counted once, so two parallel 2 ms requests report
   * `2` instead of `4`; two sequential 2 ms requests report `4`. `undefined`
   * when no request was measurable.
   */
  readonly busyMs: DurationMs | undefined;
  /**
   * Wall-clock span from the first request start to the last request
   * completion, in milliseconds. Unlike {@link busyMs}, idle gaps between
   * requests are included. `undefined` when no request was measurable.
   */
  readonly spanMs: DurationMs | undefined;
}
//#endregion
//#region src/models/page-timing.types.d.ts
/**
 * Navigation kind reported by the browser.
 *
 * `soft-navigation` is produced by TracePulse itself for an SPA route change
 * (a `history.pushState` / `replaceState` / `popstate` / `hashchange` boundary),
 * because the Navigation Timing API does not report client-side navigations.
 */
type PageNavigationType = 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'soft-navigation' | 'unknown';
/** The document navigation, from Navigation Timing when available. */
interface PageNavigationTiming {
  /** Navigation kind. */
  readonly type: PageNavigationType;
  /**
   * Navigation start on the performance timeline, in milliseconds.
   *
   * This is normally `0`, because the performance timeline starts at the
   * document's time origin. It is kept explicit so durations are derived from
   * two timestamps instead of assuming zero.
   */
  readonly startedAt: MonotonicTimestamp;
  /** When `DOMContentLoaded` finished, when reported. */
  readonly domContentLoadedAt?: MonotonicTimestamp | undefined;
  /** When the window `load` event finished, when reported. */
  readonly loadEventAt?: MonotonicTimestamp | undefined;
  /**
   * Bytes transferred for the document, including response headers.
   *
   * Absent when Navigation Timing does not expose a size (older engines) and
   * when the page crossed an origin without Timing-Allow-Origin.
   */
  readonly transferBytes?: number | undefined;
  /** Encoded (compressed) body bytes for the document, when reported. */
  readonly encodedBodyBytes?: number | undefined;
  /** Decoded (uncompressed) body bytes for the document, when reported. */
  readonly decodedBodyBytes?: number | undefined;
}
/** One paint milestone on the performance timeline. */
interface PagePaintTiming {
  /** `first-paint` or `first-contentful-paint`. */
  readonly name: string;
  /** When the paint happened, on the performance timeline. */
  readonly startedAt: MonotonicTimestamp;
}
/**
 * Resource Timing totals for the subresources observed up to capture time.
 *
 * Only entries that completed before the snapshot are included, so a resource
 * still in flight is not counted. Cross-origin resources without
 * Timing-Allow-Origin expose `0` for every size; those entries are counted in
 * `unknownRequests` instead of being silently treated as zero-byte responses.
 */
interface PageResourceTotals {
  /** Number of resource entries included in the totals. */
  readonly requests: number;
  /** Sum of `transferSize` across included entries. */
  readonly transferBytes: number;
  /** Sum of `encodedBodySize` across included entries. */
  readonly encodedBodyBytes: number;
  /** Sum of `decodedBodySize` across included entries. */
  readonly decodedBodyBytes: number;
  /**
   * Included entries whose sizes were unavailable or all zero.
   *
   * They are already part of `requests`, but not of the byte sums, so a report
   * can say how complete the total is.
   */
  readonly unknownRequests: number;
}
/** One page-level measurement. */
interface PageLoadMeasurement {
  /** Unique per captured page segment. */
  readonly id: string;
  /**
   * `document` for the initial page load, `soft-navigation` for an SPA route
   * change observed after the initial load.
   */
  readonly kind: 'document' | 'soft-navigation';
  /** The measured document URL. */
  readonly url: string;
  /**
   * When the snapshot was taken, on the performance timeline.
   *
   * For a soft-navigation segment this is the only end boundary available, so
   * `durationMs` falls back to it when Navigation Timing has no `load` event.
   */
  readonly capturedAt: MonotonicTimestamp;
  /** Document navigation timing. For a soft navigation only `startedAt` is set. */
  readonly navigation: PageNavigationTiming;
  /** Paint milestones. Empty for a soft-navigation segment. */
  readonly paints: readonly PagePaintTiming[];
  /** Largest Contentful Paint observed at capture time, for the document segment. */
  readonly largestContentfulPaintAt?: MonotonicTimestamp | undefined;
  /**
   * When the page became stable, on the performance timeline.
   *
   * Stability is the end of the last observed network activity burst: the
   * moment the document and its subresources stopped loading, followed by
   * `page.idleMs` without any new Resource Timing entry. It is present only when
   * that quiet window was actually observed before {@link capturedAt};
   * otherwise it stays absent instead of guessing a boundary.
   *
   * A request that is still in flight at capture time has no Resource Timing
   * entry yet, so a snapshot can look stable before that request settles.
   */
  readonly stableAt?: MonotonicTimestamp | undefined;
  /** Resource Timing totals for the segment. */
  readonly resources: PageResourceTotals;
}
//#endregion
//#region src/models/page-timing.d.ts
/**
 * Durations derived from {@link PageLoadMeasurement}.
 *
 * Every field is optional because a duration exists only when both of its
 * timestamps exist. All durations are measured from the navigation start, so
 * they describe one continuous page timeline and can be compared directly.
 */
interface PageDurations {
  /** `domContentLoadedAt - startedAt`, when reported. */
  readonly domContentLoadedMs?: DurationMs | undefined;
  /**
   * `loadEventAt - startedAt`, when reported.
   *
   * This is the total page load time: the document and its blocking
   * subresources are done, and the window `load` event has fired.
   */
  readonly loadEventMs?: DurationMs | undefined;
  /**
   * The observed page duration.
   *
   * Uses `loadEventAt` for a document navigation and falls back to
   * `capturedAt` for a soft navigation (and for a document whose `load` event
   * was not reported), so a snapshot always has an end boundary.
   */
  readonly durationMs?: DurationMs | undefined;
  /** `first-paint - startedAt`, when the browser reported it. */
  readonly firstPaintMs?: DurationMs | undefined;
  /** `first-contentful-paint - startedAt`, when the browser reported it. */
  readonly firstContentfulPaintMs?: DurationMs | undefined;
  /** `largest-contentful-paint - startedAt`, when observed. */
  readonly largestContentfulPaintMs?: DurationMs | undefined;
  /**
   * Time from navigation start until the page had rendered its main content.
   *
   * Uses Largest Contentful Paint when the browser reported it, and falls back
   * to First Contentful Paint when it did not. {@link PageDurations.renderBasis}
   * says which milestone was used, so the two are never conflated.
   */
  readonly renderMs?: DurationMs | undefined;
  /** Milestone backing {@link PageDurations.renderMs}. */
  readonly renderBasis?: 'lcp' | 'fcp' | undefined;
  /**
   * Time from navigation start until the page became stable.
   *
   * Present only when a quiet window of at least `page.idleMs` after the last
   * observed network activity was actually seen; never fabricated.
   */
  readonly stableMs?: DurationMs | undefined;
}
/**
 * Byte totals for one page measurement.
 *
 * Sizes come from Navigation Timing (the document) and Resource Timing (the
 * subresources). They are transfer sizes, so they describe what crossed the
 * network rather than the decoded size of every body.
 */
interface PageByteTotals {
  /** Document `transferSize`, or `0` when Navigation Timing did not report one. */
  readonly documentTransferBytes: number;
  /** Sum of resource `transferSize` values. */
  readonly resourceTransferBytes: number;
  /** Document plus resource transfer bytes. */
  readonly totalTransferBytes: number;
  /** Document plus resource encoded body bytes. */
  readonly totalEncodedBodyBytes: number;
  /** Document plus resource decoded body bytes. */
  readonly totalDecodedBodyBytes: number;
  /** Number of Resource Timing entries included. */
  readonly resourceRequests: number;
  /** Included resource entries whose sizes were unavailable or all zero. */
  readonly unknownResources: number;
}
//#endregion
//#region src/report/report.types.d.ts
/** Options for {@link Monitor.getReport}. */
interface ReportOptions {
  /**
   * Epoch milliseconds recorded as the report timestamp.
   *
   * Defaults to `Date.now()`. Accepting an explicit value keeps reports
   * deterministic in tests and server-side rendering.
   */
  readonly generatedAt?: number | undefined;
}
/** Configuration values a renderer needs to classify and label a snapshot. */
interface ReportSettings {
  /** Request thresholds active when the snapshot was taken. */
  readonly thresholds: ThresholdConfig;
  /** Page thresholds active when the snapshot was taken. */
  readonly pageThresholds: PageThresholdConfig;
  readonly colors: ColorConfig;
  readonly ownership: OwnershipConfig;
  /** Whether at least one owner label was declared. */
  readonly hasOwners: boolean;
}
/** A raw, renderer-ready snapshot returned by {@link Monitor.getReport}. */
interface TracePulseReport {
  /** Library version that produced the snapshot. */
  readonly version: string;
  /** Epoch milliseconds when the snapshot was taken. */
  readonly generatedAt: number;
  /** Latest page measurement, when page reporting is available. */
  readonly page: PageLoadMeasurement | undefined;
  /** Terminal request measurements retained at snapshot time. */
  readonly measurements: readonly RequestMeasurement[];
  readonly settings: ReportSettings;
}
/** Classification of one phase or request. */
type ReportSeverity = 'normal' | 'warning' | 'critical' | 'unavailable';
/** One measured request phase. */
type ReportStage = 'queue' | 'timeToResponse' | 'responseBody' | 'uiUpdate';
/** One phase of a request, with its duration, classification and bounds. */
interface ReportPhase {
  readonly stage: ReportStage;
  /** Human-readable label, matching the console reporter (`Queue`, …). */
  readonly label: string;
  /** Measured duration in milliseconds, or `undefined` when unavailable. */
  readonly durationMs: number | undefined;
  readonly status: ReportSeverity;
  /** Why the duration could not be classified, when it could not. */
  readonly unavailableReason: 'missing' | 'invalid-duration' | undefined;
  /** Configured warning boundary for this phase, in milliseconds. */
  readonly warningMs: number;
  /** Configured critical boundary for this phase, in milliseconds. */
  readonly criticalMs: number;
}
/** One request in a classified report. */
interface ReportEntry {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly transport: RequestTransport;
  readonly lifecycle: TerminalRequestLifecycleState;
  readonly outcome: RequestOutcome['kind'];
  readonly statusCode: number | undefined;
  readonly statusText: string | undefined;
  /** Declared `Content-Length`, when the transport exposed it. */
  readonly declaredBytes: number | undefined;
  /** Total observed duration in milliseconds, when available. */
  readonly durationMs: number | undefined;
  readonly severity: ReportSeverity;
  /** Worst phase that breached a threshold, when one did. */
  readonly flaggedStage: ReportStage | undefined;
  /** Declared owner of the flagged phase or failure, when configured. */
  readonly owner: string | undefined;
  readonly phases: readonly ReportPhase[];
}
/** One page-level metric and its classification. */
interface ReportPageMetric {
  readonly key: 'load' | 'render' | 'fcp' | 'lcp' | 'stable';
  readonly label: string;
  readonly durationMs: number | undefined;
  readonly status: ReportSeverity;
  readonly warningMs: number;
  readonly criticalMs: number;
}
/** Page-level timing and byte data included in a classified report. */
interface ReportPage {
  readonly url: string;
  readonly kind: 'document' | 'soft-navigation';
  readonly navigationType: PageNavigationType;
  readonly durations: PageDurations;
  readonly bytes: PageByteTotals;
  /**
   * Aggregate time spent by the monitored requests in this report.
   *
   * Overlapping requests are counted once and sequential requests contribute
   * their full elapsed time, so this is network time rather than the sum of
   * every duration.
   */
  readonly api: ApiTotals;
  readonly metrics: readonly ReportPageMetric[];
  readonly severity: ReportSeverity;
}
/** Counted flagged phases across the report, with the declared owner. */
interface ReportStageSummary {
  readonly stage: ReportStage;
  readonly label: string;
  readonly count: number;
  readonly owner: string | undefined;
  readonly warningMs: number;
  readonly criticalMs: number;
}
/** Counted requests attributed to one declared owner. */
interface ReportOwnerSummary {
  readonly owner: string;
  readonly count: number;
}
/** Request-level rollups for a classified report. */
interface ReportSummary {
  readonly total: number;
  readonly bySeverity: Readonly<Record<ReportSeverity, number>>;
  /** Requests whose lifecycle is `failed` (network error or timeout). */
  readonly failed: number;
  /** Requests with no declared owner, including healthy ones. */
  readonly unassigned: number;
  readonly byStage: readonly ReportStageSummary[];
  readonly byOwner: readonly ReportOwnerSummary[];
  readonly declaredBytes: number;
  readonly measuredResponses: number;
  readonly unknownResponses: number;
}
/** A classified report produced by the `/report` entry. */
interface ReportView {
  readonly version: string;
  readonly generatedAt: number;
  readonly page: ReportPage | undefined;
  /** Requests sorted worst-first: severity, then total duration. */
  readonly entries: readonly ReportEntry[];
  readonly summary: ReportSummary;
  readonly settings: ReportSettings;
}
//#endregion
//#region src/report/build-report.d.ts
/**
 * Classifies a raw snapshot into a renderer-ready view.
 *
 * Non-terminal snapshots are ignored defensively. Entries are sorted
 * worst-first, so a report is readable even when its JavaScript is blocked.
 */
export declare function createReportView(report: TracePulseReport): ReportView;
//#endregion
//#region src/monitor/monitor.d.ts
/**
 * A request monitor.
 *
 * Obtain one with {@link createMonitor}. The interface is deliberately small:
 * lifecycle control is public, while measurement, classification and formatting
 * stay internal.
 */
interface Monitor {
  /**
   * Installs fetch/XHR instrumentation and begins reporting measurements.
   *
   * Idempotent: calling it while this monitor is already running does nothing.
   * No-op when the resolved configuration has `enabled: false`; that setting is
   * fixed when `createMonitor()` resolved the configuration.
   *
   * @returns this monitor, so calls can be chained.
   * @throws {TracePulseError} `INVALID_STATE` when another monitor is running.
   * @throws {Error} when an installer fails; an already-installed transport is
   *   uninstalled before the error is rethrown.
   */
  start(): this;
  /**
   * Stops monitoring and uninstalls this monitor's instrumentation.
   *
   * Idempotent. A third-party wrapper installed after this monitor started is
   * left in place. In-flight requests are not cancelled; they settle with their
   * original results and are no longer observed.
   *
   * @returns this monitor, so calls can be chained.
   */
  stop(): this;
  /**
   * Returns the current page measurement, or `undefined` when page measurement
   * is disabled or unavailable in this runtime.
   *
   * With `page.mode: "once"` this is the captured initial load (also after
   * `stop()`). With `page.mode: "continuous"` it is a fresh snapshot, so newly
   * arrived resources are reflected.
   */
  page(): PageLoadMeasurement | undefined;
  /**
   * Captures and reports the current page measurement immediately.
   *
   * This is the on-demand counterpart to continuous mode: useful before an
   * export or when an application wants a page snapshot at a defined moment.
   * No-op when page measurement is disabled.
   *
   * @returns this monitor, so calls can be chained.
   */
  reportPage(): this;
  /**
   * Replaces one or more request threshold boundaries at runtime.
   *
   * Only the supplied boundaries change; every other category keeps its current
   * value, including values set by an earlier `createMonitor()` call or a
   * previous `setThresholds()`. Validation is identical to configuration
   * resolution, and an invalid update throws without changing anything.
   *
   * Subsequent measurements are classified with the new boundaries. Already
   * reported measurements keep the status they were reported with. Page
   * thresholds are not affected: use `page.thresholds` at creation time for
   * those.
   *
   * `setThresholds()` works whether the monitor is running or idle, so end-user
   * choices do not require `stop()` and a new `createMonitor()`.
   *
   * @param thresholds - Partial request threshold overrides.
   * @returns this monitor, so calls can be chained.
   *
   * @throws {TypeError} for wrong types, shapes or a removed key.
   * @throws {RangeError} for negative or non-finite boundaries, or when the
   *   merged pair does not satisfy `warningMs < criticalMs`.
   */
  setThresholds(thresholds: ThresholdConfigInput): this;
  /**
   * Takes a raw snapshot of the terminal measurements retained so far.
   *
   * The snapshot contains the measurements plus the thresholds, colours and
   * ownership mapping that were active when it was taken. It is deliberately
   * unclassified: the opt-in `@codewithrajat/tracepulse/report` entry turns it
   * into a report. Snapshots are generated locally; no data is sent anywhere.
   *
   * The snapshot works whether the monitor is running or stopped, and it is
   * independent of `console.enabled`. Retention is bounded by
   * `report.maxEntries`; when the cap is reached, the oldest measurement is
   * dropped first.
   *
   * @returns A frozen snapshot suitable for the opt-in
   *   `@codewithrajat/tracepulse/report` entry.
   */
  getReport(options?: ReportOptions): TracePulseReport;
  /**
   * Drops every measurement retained for report export.
   *
   * Only the report store is cleared. The console reporter's own session, which
   * powers its deltas and trends, is untouched.
   *
   * @returns this monitor, so calls can be chained.
   */
  clearMeasurements(): this;
}
//#endregion
//#region src/report/download.d.ts
/** Options for {@link installReportShortcut}. */
interface ReportShortcutOptions {
  /** Key to combine with Ctrl/Cmd+Shift. Defaults to `e`. */
  readonly key?: string | undefined;
  /** Require Shift. Defaults to `true`. */
  readonly shiftKey?: boolean | undefined;
  /** Require Alt. Defaults to `false`. */
  readonly altKey?: boolean | undefined;
  /** Downloaded file name. Defaults to a timestamped name. */
  readonly filename?: string | undefined;
  /** Report heading. Defaults to the renderer default. */
  readonly title?: string | undefined;
}
/**
 * Downloads a rendered HTML report through a temporary object URL.
 *
 * This is an explicit call, not a hidden side effect: the library binds no
 * listener and writes no file unless this function (or
 * {@link installReportShortcut}) is invoked.
 *
 * @throws {Error} when called outside a browser-like environment.
 */
export declare function downloadHtmlReport(html: string, filename?: string): void;
/**
 * Installs an opt-in keyboard shortcut that exports the current report.
 *
 * Defaults to `Ctrl+Shift+E` (`Cmd+Shift+E` on macOS). The caller owns the
 * lifetime: the returned function removes the listener.
 *
 * @throws {Error} when called outside a browser-like environment.
 */
export declare function installReportShortcut(monitor: Monitor, options?: ReportShortcutOptions): () => void;
//#endregion
//#region src/report/render-html.d.ts
/** Options for {@link createHtmlReport}. */
interface HtmlReportOptions {
  /** Document title and page heading. Defaults to `TracePulse performance report`. */
  readonly title?: string | undefined;
}
/**
 * Renders a complete, self-contained HTML document.
 *
 * The output is deterministic for a fixed report: no clock read, no locale
 * lookup and no network access.
 */
export declare function createHtmlReport(report: TracePulseReport, options?: HtmlReportOptions): string;
//#endregion
//#region src/report/render-json.d.ts
/** Options for {@link createJsonReport}. */
interface JsonReportOptions {
  /** Pretty-print with two-space indentation. Defaults to `true`. */
  readonly pretty?: boolean | undefined;
}
/** Serialises a report as JSON. */
export declare function createJsonReport(report: TracePulseReport, options?: JsonReportOptions): string;
//#endregion
export type { HtmlReportOptions, JsonReportOptions, ReportEntry, ReportOptions, ReportOwnerSummary, ReportPage, ReportPageMetric, ReportPhase, ReportSettings, ReportSeverity, ReportShortcutOptions, ReportStage, ReportStageSummary, ReportSummary, ReportView, TracePulseReport };