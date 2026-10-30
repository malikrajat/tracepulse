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
/** Partial overrides for {@link OwnershipConfig}. */
interface OwnershipConfigInput {
  /** @see OwnershipConfig.queueMs */
  queueMs?: string | undefined;
  /** @see OwnershipConfig.timeToResponseMs */
  timeToResponseMs?: string | undefined;
  /** @see OwnershipConfig.responseProcessingMs */
  responseProcessingMs?: string | undefined;
  /** @see OwnershipConfig.uiUpdateMs */
  uiUpdateMs?: string | undefined;
  /** @see OwnershipConfig.serverError */
  serverError?: string | undefined;
  /** @see OwnershipConfig.clientError */
  clientError?: string | undefined;
  /** @see OwnershipConfig.failure */
  failure?: string | undefined;
}
/**
 * Minimum severity that produces console output.
 *
 * Severity is the classification the reporter already derives: a request is
 * `warning` when any phase, an error status or an abort needs attention, and
 * `critical` when a phase breaches its critical boundary, the request failed or
 * the response is a 5xx. There is no separate debug/trace channel, so `level`
 * filters whole reports rather than individual messages.
 *
 * - `all` — every terminal request and page report (default).
 * - `warning` — warnings and criticals; healthy requests stay silent.
 * - `critical` — criticals only.
 * - `off` — nothing is written, even when {@link ConsoleConfig.enabled} is
 *   `true`.
 */
type ConsoleLevel = 'all' | 'warning' | 'critical' | 'off';
/**
 * Preferences for the developer-console reporter.
 *
 * @remarks
 * Reporting is currently internal. The reporter writes to the global
 * `console`; the public `createMonitor()` API wires it to the transport
 * instrumentation.
 */
interface ConsoleConfig {
  /**
   * Whether measurement reports are written to the console.
   *
   * When `false`, the reporter does not call `console.table`, `console.log`,
   * `console.warn` or `console.error`.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Minimum severity that produces console output.
   *
   * Reports below the level are still accumulated for trend and count
   * calculations, but they never write a table, header or summary line. With
   * `replace: true`, the accumulated table only contains entries at or above
   * the level, so a hidden category stays hidden.
   *
   * The default comes from the `TRACEPULSE_LOG_LEVEL` environment variable at
   * build time; when it is unset or not a valid level, `all` is used.
   *
   * @default "all"
   */
  level: ConsoleLevel;
  /**
   * Whether healthy requests are left out of console output.
   *
   * This is a pass/fail filter, independent of {@link ConsoleConfig.level}
   * (which is a minimum severity). When `true`, a request is written only when
   * it carries a health signal:
   *
   * - it is classified `warning` or `critical`;
   * - it failed, timed out or was aborted, or its response is an HTTP error;
   * - or a phase is still normal but within 20% of its warning boundary (the
   *   `watch` / `near limit` signal).
   *
   * A request that is fully within its thresholds is still accumulated for
   * trend, delta and count calculations, but it never writes a header, table or
   * summary line. `unavailable` is not treated as healthy, so an unmeasured
   * request is kept rather than silently dropped.
   *
   * Both filters apply: `level` sets a floor and `onlyIssues` hides healthy
   * samples, so the stricter of the two wins. Unlike `level: "critical"`, this
   * keeps a warning-classified failure (a 4xx or an abort) visible while
   * hiding green requests.
   *
   * The filter applies consistently to the table, the summary, a `replace`
   * redraw, page reports and the in-page panel. Exported reports are never
   * filtered by it.
   *
   * @default false
   */
  onlyIssues: boolean;
  /**
   * Whether CSS-formatted colors are applied to the summary line.
   *
   * @default true
   */
  useColors: boolean;
  /**
   * Whether a structured `console.table` row is written alongside the summary.
   *
   * In the default grouped mode this is the table for the single new request.
   * With `replace: true` it is the accumulated session table.
   *
   * @default true
   */
  showTable: boolean;
  /**
   * Whether each request is reported inside an expandable console group.
   *
   * When `true` (the default), each completed request adds one collapsed
   * `console.groupCollapsed` header to the console. Expanding it reveals that
   * request's table row and the session summary, so a long session does not
   * flood the console with repeated growing tables.
   *
   * When `false`, the header is written as a plain `console.log` line instead.
   *
   * This setting has no effect when `replace` is `true`, because that mode
   * prints one accumulated session table instead of per-request groups.
   *
   * @default true
   */
  collapsible: boolean;
  /**
   * Whether the console is cleared before the accumulated session table is
   * printed.
   *
   * When `true`, the console shows one literal table for the whole session and
   * each report redraws it in place. When `false` (the default), the reporter
   * appends one collapsed group per request instead of reprinting the growing
   * session table.
   *
   * Clearing also removes the host application's own console output, so this is
   * opt-in.
   *
   * Has no effect when {@link ConsoleConfig.panel} is `true`.
   *
   * @default false
   */
  replace: boolean;
  /**
   * Whether the session is rendered in an in-page panel instead of the console.
   *
   * A browser console cannot remove or update a single entry: the only erase
   * API is `console.clear()`, which also discards the host application's own
   * output. A session table that gains a row per request therefore either
   * floods the console with copies or forces a full clear.
   *
   * When `true`, the reporter appends one small overlay to the document on the
   * first rendered report, keeps it collapsed by default, and updates it in
   * place after every request. The console is not written to at all, so the
   * application's logs are never flooded or cleared. Expanding the panel shows
   * the session summary, the page report and one table row per request
   * occurrence — a repeated URL gets a new row, never a merged one.
   *
   * The panel owns the output, so it takes precedence over
   * {@link ConsoleConfig.replace} and {@link ConsoleConfig.collapsible}, which
   * describe console output only. It still honors `enabled`, `level`,
   * `useColors` and `showTable`.
   *
   * Runtimes without a DOM (Node, Deno without a `document`, edge workers) fall
   * back to the console output, so no report is silently lost.
   *
   * @default false
   */
  panel: boolean;
}
/**
 * Retention settings for exported reports.
 *
 * The monitor keeps terminal request measurements in a bounded in-memory store
 * so {@link Monitor.getReport} can produce a snapshot after the fact. This is
 * independent of {@link ConsoleConfig}: measurements are retained even when
 * console output is disabled.
 */
interface ReportConfig {
  /**
   * Whether terminal measurements are retained for report export.
   *
   * When `false`, {@link Monitor.getReport} returns an empty report and no
   * measurement references are kept.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Maximum number of terminal measurements retained.
   *
   * Once the limit is reached, the oldest measurement is dropped first. Set to
   * `0` to retain nothing (equivalent to `enabled: false` for storage).
   *
   * @default 500
   */
  maxEntries: number;
}
/**
 * How long page-level monitoring runs.
 *
 * - `once` — capture the initial document after its `load` event and stop
 *   observing. This is the bounded mode for traditional, non-SPA pages.
 * - `continuous` — keep observing Resource Timing and LCP after the initial
 *   report, and (with {@link PageConfig.spa}) start a new segment on every
 *   client-side history change. Use this for long-lived SPA sessions.
 */
type PageMode = 'once' | 'continuous';
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
/** Partial overrides for {@link PageThresholdConfig}. */
interface PageThresholdConfigInput {
  /** @see PageThresholdConfig.pageLoadMs */
  pageLoadMs?: DurationThresholdInput | undefined;
  /** @see PageThresholdConfig.firstContentfulPaintMs */
  firstContentfulPaintMs?: DurationThresholdInput | undefined;
  /** @see PageThresholdConfig.largestContentfulPaintMs */
  largestContentfulPaintMs?: DurationThresholdInput | undefined;
  /** @see PageThresholdConfig.pageStableMs */
  pageStableMs?: DurationThresholdInput | undefined;
}
/**
 * Page-level measurement configuration.
 *
 * Page measurement is browser-only: without `performance.getEntriesByType` the
 * monitor produces no page report and the rest of the configuration is
 * unaffected.
 *
 * @remarks
 * `spa` is deliberately explicit. TracePulse does not guess whether an
 * application is an SPA: a client-side route change looks identical to an
 * ordinary URL update, and treating one as a page boundary when it is not
 * would fabricate segments.
 */
interface PageConfig {
  /**
   * Whether page-level timing is measured and reported.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Bounded (`once`) or long-lived (`continuous`) observation.
   *
   * @default "once"
   */
  mode: PageMode;
  /**
   * Treat `history.pushState` / `replaceState` / `popstate` / `hashchange` as
   * page boundaries. Only meaningful with `mode: "continuous"`.
   *
   * @default false
   */
  spa: boolean;
  /**
   * Delay after `load` before capturing, so late resources and LCP entries are
   * included. `0` captures immediately.
   *
   * @default 300
   */
  settleMs: number;
  /**
   * Include Resource Timing entries in the page byte totals.
   *
   * When `false`, the page report still includes Navigation Timing and paints,
   * but the resource totals are zero.
   *
   * @default true
   */
  resources: boolean;
  /**
   * Quiet window required to consider the page stable, in milliseconds.
   *
   * The page is stable once the last observed Resource Timing entry or the
   * `load` event has ended and nothing new has been reported for this long. The
   * boundary is only published when the quiet window was actually observed
   * before the snapshot; otherwise the stable duration stays unavailable.
   *
   * Keep this at or below `settleMs` so the default capture has a chance to
   * prove stability.
   *
   * @default 300
   */
  idleMs: number;
  /** Page-level warning/critical boundaries. */
  thresholds: PageThresholdConfig;
}
/** User-supplied page configuration; every property is optional. */
interface PageConfigInput {
  /** @see PageConfig.enabled */
  enabled?: boolean | undefined;
  /** @see PageConfig.mode */
  mode?: PageMode | undefined;
  /** @see PageConfig.spa */
  spa?: boolean | undefined;
  /** @see PageConfig.settleMs */
  settleMs?: number | undefined;
  /** @see PageConfig.resources */
  resources?: boolean | undefined;
  /** @see PageConfig.idleMs */
  idleMs?: number | undefined;
  /** Partial overrides for {@link PageThresholdConfig}. */
  thresholds?: PageThresholdConfigInput | undefined;
}
/**
 * Fully resolved monitor configuration.
 *
 * Every property is required; use {@link MonitorConfigInput} when providing
 * configuration, so individual nested properties can be overridden.
 */
interface MonitorConfig {
  /**
   * Whether monitoring is enabled at all.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Whether monitoring starts automatically when the library is initialized.
   *
   * Kept separate from `enabled` so a monitor can be configured up front and
   * started explicitly later.
   *
   * @default true
   */
  autoStart: boolean;
  /**
   * URL exclusion rules.
   *
   * These rules describe URLs requested by the **host application** through
   * `fetch()` / `XMLHttpRequest` (for example analytics beacons or third-party
   * APIs). TracePulse itself calls no HTTP endpoints and sends no data.
   *
   * A request is excluded when its URL **contains** one of these strings
   * (case-sensitive substring match against the full URL, including query
   * string and hash). The list is empty by default, meaning every supported
   * request is monitored.
   *
   * @example ["https://analytics.example.com", "/telemetry"]
   *
   * @default []
   */
  exclude: readonly string[];
  /** Page-level timing and byte measurement. */
  page: PageConfig;
  /** Performance thresholds, in milliseconds. */
  thresholds: ThresholdConfig;
  /**
   * Declared owners for flagged phases and failure classes.
   *
   * Empty by default: no owner is guessed or inferred.
   */
  ownership: OwnershipConfig;
  /** Console output colors. */
  colors: ColorConfig;
  /** Console reporting preferences. */
  console: ConsoleConfig;
  /** Retention settings for exported reports. */
  report: ReportConfig;
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
/** Partial overrides for {@link ColorConfig}. */
interface ColorConfigInput {
  /** @see ColorConfig.normal */
  normal?: ColorValue | undefined;
  /** @see ColorConfig.warning */
  warning?: ColorValue | undefined;
  /** @see ColorConfig.critical */
  critical?: ColorValue | undefined;
}
/** Partial overrides for {@link ReportConfig}. */
interface ReportConfigInput {
  /** @see ReportConfig.enabled */
  enabled?: boolean | undefined;
  /** @see ReportConfig.maxEntries */
  maxEntries?: number | undefined;
}
/** Partial overrides for {@link ConsoleConfig}. */
interface ConsoleConfigInput {
  /** @see ConsoleConfig.enabled */
  enabled?: boolean | undefined;
  /** @see ConsoleConfig.level */
  level?: ConsoleLevel | undefined;
  /** @see ConsoleConfig.onlyIssues */
  onlyIssues?: boolean | undefined;
  /** @see ConsoleConfig.useColors */
  useColors?: boolean | undefined;
  /** @see ConsoleConfig.showTable */
  showTable?: boolean | undefined;
  /** @see ConsoleConfig.collapsible */
  collapsible?: boolean | undefined;
  /** @see ConsoleConfig.replace */
  replace?: boolean | undefined;
  /** @see ConsoleConfig.panel */
  panel?: boolean | undefined;
}
/**
 * User-supplied configuration.
 *
 * Identical to {@link MonitorConfig} except that every property is optional and
 * nested groups accept partial objects, so a single threshold boundary, color
 * or console preference can be overridden without repeating the rest.
 *
 * @example
 * ```ts
 * const input: MonitorConfigInput = {
 *   exclude: ['/telemetry'],
 *   thresholds: { timeToResponseMs: { warningMs: 1500 } },
 *   console: { showTable: false },
 * }
 * ```
 */
interface MonitorConfigInput {
  /** @see MonitorConfig.enabled */
  enabled?: boolean | undefined;
  /** @see MonitorConfig.autoStart */
  autoStart?: boolean | undefined;
  /** @see MonitorConfig.exclude */
  exclude?: readonly string[] | undefined;
  /** Partial overrides for {@link PageConfig}. */
  page?: PageConfigInput | undefined;
  /** Partial overrides for {@link ThresholdConfig}. */
  thresholds?: ThresholdConfigInput | undefined;
  /** Partial overrides for {@link OwnershipConfig}. */
  ownership?: OwnershipConfigInput | undefined;
  /** Partial overrides for {@link ColorConfig}. */
  colors?: ColorConfigInput | undefined;
  /** Partial overrides for {@link ConsoleConfig}. */
  console?: ConsoleConfigInput | undefined;
  /** Partial overrides for {@link ReportConfig}. */
  report?: ReportConfigInput | undefined;
}
//#endregion
//#region src/config/config.defaults.d.ts
/**
 * The single source of truth for every default value.
 *
 * The object is deeply frozen at runtime. `resolveConfig()` never mutates it;
 * it always builds a fresh configuration.
 *
 * @see {@link MonitorConfig} for the meaning of each property.
 */
export declare const DEFAULT_CONFIG: Readonly<MonitorConfig>;
//#endregion
//#region src/config/resolve-config.d.ts
/**
 * Merges user configuration with {@link DEFAULT_CONFIG}.
 *
 * Merge rules:
 * - Top-level settings are overridden individually.
 * - `thresholds`, `colors` and `console` are merged **per property**.
 * - Within a threshold category, `warningMs` and `criticalMs` are merged
 *   independently, so overriding only the warning boundary keeps the default
 *   critical boundary.
 * - `exclude` is replaced wholesale (never concatenated) and copied.
 * - `undefined` means "not provided" and falls back to the default. This also
 *   makes plain-JavaScript callers safe.
 *
 * The function is pure: it never mutates `DEFAULT_CONFIG` or `input`, and the
 * returned object shares no mutable arrays or nested objects with either of
 * them.
 *
 * @param input - Partial configuration from the caller.
 * @returns A new, fully resolved {@link MonitorConfig}.
 *
 * @throws {TypeError} for wrong types, shapes or invalid color strings.
 * @throws {RangeError} for negative or non-finite thresholds, or when a
 *   merged category does not satisfy `warningMs < criticalMs`.
 *
 * @example
 * ```ts
 * const config = resolveConfig({
 *   exclude: ['/telemetry'],
 *   thresholds: { timeToResponseMs: { warningMs: 1500 } },
 * })
 *
 * config.thresholds.timeToResponseMs.warningMs // 1500
 * config.thresholds.timeToResponseMs.criticalMs // 3000 (default preserved)
 * config.thresholds.responseProcessingMs.criticalMs // 500 (default)
 * config.console.showTable // true (default)
 * ```
 */
export declare function resolveConfig(input?: MonitorConfigInput): MonitorConfig;
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
 * Lifecycle state of an observed request.
 *
 * State and HTTP outcome are separate concerns: a 404 response reaches
 * `completed` with an {@link HttpErrorOutcome}, while a rejected `fetch()`
 * reaches `failed` with a {@link NetworkErrorOutcome}.
 */
type RequestLifecycleState = 'pending' | 'headers-received' | 'completed' | 'failed' | 'aborted';
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
/**
 * Durations derived from {@link RequestTiming}.
 *
 * Every field is optional because a duration exists only when both of its
 * timestamps exist. The fields are always present (possibly `undefined`) so
 * destructuring and spreading behave predictably.
 */
interface RequestDurations {
  /**
   * `sentAt - queuedAt`, when both are available.
   *
   * How long the request waited between entering the client-side queue and being
   * handed to the transport. `undefined` for transports that cannot observe a
   * dispatch boundary.
   */
  readonly queueMs?: DurationMs | undefined;
  /**
   * `completedAt - (queuedAt ?? startedAt)`, when both are available.
   *
   * The observed total. It begins at the queue boundary when one was recorded,
   * so the four phases (`queueMs`, `timeToResponseMs`, `responseBodyMs` and an
   * explicitly supplied UI interval) describe one continuous timeline.
   */
  readonly durationMs?: DurationMs | undefined;
  /**
   * `responseStartedAt - (sentAt ?? startedAt)`, when both are available.
   *
   * Wait for response headers. When `sentAt` exists it excludes the queue
   * interval, so the phases do not overlap.
   */
  readonly timeToResponseMs?: DurationMs | undefined;
  /** `responseCompletedAt - responseStartedAt`, when both are available. */
  readonly responseBodyMs?: DurationMs | undefined;
}
/**
 * Elapsed monotonic time between two timestamps, in milliseconds.
 *
 * Returns `undefined` — never a fabricated `0` and never a negative number —
 * when either timestamp is unavailable, not finite, or when `to` precedes
 * `from`. An out-of-order pair usually means two different clocks were mixed,
 * so the result is treated as unavailable rather than reported as a negative
 * duration.
 *
 * @example
 * ```ts
 * elapsedMs(100, 180) // 80
 * elapsedMs(100, undefined) // undefined
 * ```
 */
export declare function elapsedMs(from: MonotonicTimestamp | undefined, to: MonotonicTimestamp | undefined): DurationMs | undefined;
/**
 * Derives every available duration from a measurement's timing data.
 *
 * This is the single reusable way to turn timestamps into durations; the
 * measurement model does not store duration fields, so the two cannot drift
 * apart. Missing measurements stay `undefined`.
 *
 * @example
 * ```ts
 * const durations = getRequestDurations(measurement.timing)
 * durations.queueMs // number | undefined
 * durations.durationMs // number | undefined
 * durations.timeToResponseMs // number | undefined
 * durations.responseBodyMs // number | undefined
 * ```
 */
export declare function getRequestDurations(timing: RequestTiming): RequestDurations;
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
/**
 * Derives the aggregate network time for a set of measurements.
 *
 * @example
 * ```ts
 * const totals = getApiTotals(monitor.getReport().measurements)
 * totals.requests // 12
 * totals.busyMs // 2100 — parallel requests counted once
 * totals.spanMs // 3400 — first start → last completion
 * ```
 */
export declare function getApiTotals(measurements: readonly RequestMeasurement[]): ApiTotals;
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
/**
 * Derives every available duration from a page measurement.
 *
 * Unavailable values stay `undefined`; nothing is fabricated as `0`.
 *
 * @example
 * ```ts
 * const durations = getPageDurations(page)
 * durations.durationMs // total page load, e.g. 1240
 * durations.largestContentfulPaintMs // 640
 * ```
 */
export declare function getPageDurations(measurement: PageLoadMeasurement): PageDurations;
/**
 * Derives the byte rollup for a page measurement.
 *
 * Resource sizes are the browser's reported values. When a cross-origin
 * resource has no Timing-Allow-Origin header, the browser reports every size as
 * `0`; those entries are counted in `unknownResources` so a total is not
 * presented as complete when it is not.
 *
 * @example
 * ```ts
 * const bytes = getPageByteTotals(page)
 * bytes.totalTransferBytes // document + subresources, in bytes
 * bytes.unknownResources // entries that could not be counted honestly
 * ```
 */
export declare function getPageByteTotals(measurement: PageLoadMeasurement): PageByteTotals;
//#endregion
//#region src/models/response-bytes.d.ts
/**
 * Declared response size for one measurement.
 *
 * `declaredBytes` is the `Content-Length` the transport reported, when it was a
 * plain non-negative safe integer. It is **not** a decoded body measurement:
 * the header may be absent for chunked responses and may describe the
 * compressed size. Response bodies are never read just to measure them.
 */
interface ResponseBytes {
  /** The declared size, or `undefined` when the transport did not expose one. */
  readonly declaredBytes: number | undefined;
}
/**
 * Aggregate declared response bytes across measurements.
 *
 * `measuredResponses` counts the measurements that contributed to
 * `declaredBytes`; `unknownResponses` counts the rest, so a total can be
 * presented with an honest completeness figure instead of looking authoritative
 * when half the responses had no `Content-Length`.
 */
interface ResponseByteTotals {
  /** Sum of every declared size. */
  readonly declaredBytes: number;
  /** Measurements that contributed a declared size. */
  readonly measuredResponses: number;
  /** Measurements with no trustworthy declared size. */
  readonly unknownResponses: number;
  /** Total measurements considered. */
  readonly responses: number;
}
/**
 * Returns the declared response size for one measurement.
 *
 * Always returns an object with the same shape, so destructuring is safe. A
 * measurement without response metadata (for example `pending`) yields
 * `{ declaredBytes: undefined }`.
 *
 * @example
 * ```ts
 * getResponseBytes(measurement).declaredBytes // 2048 | undefined
 * ```
 */
export declare function getResponseBytes(measurement: RequestMeasurement): ResponseBytes;
/**
 * Sums declared response bytes across measurements.
 *
 * This is the honest rollup available without reading bodies: it is a sum of
 * `Content-Length` values, so it can undercount chunked or opaque responses and
 * applies to compressed sizes. Use `unknownResponses` to see how complete the
 * total is.
 *
 * @example
 * ```ts
 * const totals = sumResponseBytes(session)
 * totals.declaredBytes // 1_458_176
 * totals.unknownResponses // 3
 * ```
 */
export declare function sumResponseBytes(measurements: readonly RequestMeasurement[]): ResponseByteTotals;
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
/**
 * Creates a request monitor from partial configuration.
 *
 * The input is resolved exactly once with {@link resolveConfig}; invalid input
 * throws the same `TypeError` / `RangeError` as `resolveConfig()`.
 *
 * With the default `enabled: true` and `autoStart: true`, the monitor starts
 * immediately. Use `autoStart: false` to prepare an idle monitor, or
 * `enabled: false` to create one that never starts.
 *
 * `enabled` is fixed when this function resolves the configuration: there is no
 * public method to enable a disabled monitor later. Create a new monitor after
 * stopping the current one when the setting must change.
 *
 * @example
 * ```ts
 * import { createMonitor } from '@codewithrajat/tracepulse'
 *
 * // Create an idle monitor, then start it explicitly.
 * const monitor = createMonitor({ autoStart: false })
 * monitor.start()
 *
 * // Later:
 * monitor.stop()
 * ```
 *
 * @throws {TypeError} for invalid configuration input.
 * @throws {RangeError} for invalid numeric or threshold configuration.
 * @throws {TracePulseError} `INVALID_STATE` when auto-starting while another
 *   monitor is already running.
 * @throws {Error} when auto-start installation fails; any transport installed
 *   before the failure is uninstalled first.
 */
export declare function createMonitor(input?: MonitorConfigInput): Monitor;
//#endregion
//#region src/core/errors.d.ts
/**
 * Error type used by every runtime validation in the package.
 *
 * Consumers can `instanceof`-check or switch on {@link TracePulseError.code}
 * instead of parsing messages.
 */
/** Stable, machine-readable error codes. These are part of the public API. */
type TracePulseErrorCode = 'INVALID_OPTION' | 'INVALID_ARGUMENT' | 'INVALID_STATE' | 'PLUGIN_ERROR';
/** Options accepted by the {@link TracePulseError} constructor. */
interface TracePulseErrorOptions {
  /** The underlying error, if this error wraps another one. */
  cause?: unknown;
}
/** The error thrown by TracePulse for invalid options, arguments or state. */
export declare class TracePulseError extends Error {
  /** Stable error code, useful for programmatic handling. */
  readonly code: TracePulseErrorCode;
  constructor(code: TracePulseErrorCode, message: string, options?: TracePulseErrorOptions);
}
/**
 * Narrowing helper for {@link TracePulseError} instances from this module copy.
 *
 * It uses `instanceof`, so it is false for an error created by a different
 * realm or a duplicate package copy. When that matters, check the stable
 * `name` / `code` fields instead.
 */
export declare function isTracePulseError(value: unknown): value is TracePulseError;
/**
 * Throws a {@link TracePulseError} when `condition` is falsy.
 *
 * Declared as an assertion function so TypeScript narrows afterwards.
 *
 * @example
 * ```ts
 * invariant(typeof value === 'string', 'INVALID_ARGUMENT', 'value must be a string')
 * value.toUpperCase() // `value` is now `string`
 * ```
 */
export declare function invariant(condition: unknown, code: TracePulseErrorCode, message: string): asserts condition;
//#endregion
//#region src/core/types.d.ts
/**
 * Public types for TracePulse.
 *
 * Everything exported from this module is part of the published API surface.
 * Internal helpers live in `src/utils` and are only exported when they are
 * genuinely useful to consumers.
 */
/** Lifecycle state of a {@link TracePulse} instance. */
type TracePulseStatus = 'idle' | 'running' | 'stopped' | 'disposed';
/** A timestamp provider. Injectable to make behaviour deterministic in tests. */
type Clock = () => number;
/** An id provider. Injectable to make behaviour deterministic in tests. */
type IdFactory = () => string;
/** Arbitrary, JSON-ish user payload attached to a pulse. */
type PulseData = Readonly<Record<string, unknown>>;
/** A single recorded pulse. */
interface PulseEvent {
  /** Unique id, produced by `options.idFactory`. */
  readonly id: string;
  /** Logical name of the pulse, e.g. `"render"` or `"request"`. */
  readonly name: string;
  /** Creation timestamp, produced by `options.clock`. */
  readonly timestamp: number;
  /** Optional user payload. */
  readonly data?: PulseData | undefined;
}
/**
 * Map of every event a TracePulse instance can emit.
 */
interface TracePulseEventMap {
  start: {
    readonly timestamp: number;
  };
  stop: {
    readonly timestamp: number;
  };
  pulse: PulseEvent;
  error: Error;
  dispose: {
    readonly timestamp: number;
  };
}
/** Options accepted by the {@link TracePulse} constructor. */
interface TracePulseOptions {
  /** Instance name, used in error messages and diagnostics. Default: `"tracepulse"`. */
  name?: string | undefined;
  /** When `false`, the instance never starts and never records. Default: `true`. */
  enabled?: boolean | undefined;
  /** Fraction (`0`–`1`) of pulses that are recorded. Default: `1`. */
  sampleRate?: number | undefined;
  /** Maximum number of pulses kept in memory. `0` disables history. Default: `50`. */
  maxHistory?: number | undefined;
  /** Timestamp provider. Default: `Date.now`. */
  clock?: Clock | undefined;
  /** Id provider. Default: a `crypto.randomUUID()`-based id. */
  idFactory?: IdFactory | undefined;
}
/** Options after defaults have been applied and validated. */
interface ResolvedTracePulseOptions {
  readonly name: string;
  readonly enabled: boolean;
  readonly sampleRate: number;
  readonly maxHistory: number;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
}
/**
 * The subset of a TracePulse instance exposed to plugins.
 *
 * Keeping this interface narrow means plugins cannot reach into internals,
 * and keeps `TracePulse` structurally assignable without circular imports.
 */
interface TracePulsePluginApi {
  readonly name: string;
  readonly status: TracePulseStatus;
  readonly history: readonly PulseEvent[];
  pulse(name: string, data?: PulseData): PulseEvent | undefined;
  on<EventName extends keyof TracePulseEventMap>(event: EventName, listener: (payload: TracePulseEventMap[EventName]) => void): () => void;
}
/**
 * A TracePulse plugin.
 *
 * `setup()` may return a teardown function, which is invoked when the host
 * instance is disposed.
 *
 * @example
 * ```ts
 * const metricsPlugin: TracePulsePlugin = {
 *   name: 'metrics',
 *   setup(api) {
 *     return api.on('pulse', (event) => record(event))
 *   },
 * }
 * ```
 */
interface TracePulsePlugin {
  readonly name: string;
  /**
   * Called once with a narrow, stable API.
   *
   * Return a function to clean up when the host instance is disposed.
   * Returning nothing (or `undefined`) is also valid.
   */
  setup(api: TracePulsePluginApi): undefined | (() => void);
}
//#endregion
//#region src/core/options.d.ts
/**
 * Defaults applied to every instance.
 *
 * Exported so consumers can inspect them (for example in tests) without
 * hard-coding magic numbers.
 */
export declare const DEFAULT_OPTIONS: Readonly<ResolvedTracePulseOptions>;
//#endregion
//#region src/utils/emitter.d.ts
/**
 * A tiny, dependency-free, fully typed event emitter.
 *
 * It is exported because it is genuinely useful on its own, but it is also the
 * backbone of {@link TracePulse}. No Node.js or DOM APIs are used, so it runs
 * in browsers, workers, Node, Deno and Bun alike.
 */
/** A listener for a single event. */
type TypedEventListener<Payload> = (payload: Payload) => void;
/** Returned by every subscription; call it to remove the listener. */
type Unsubscribe = () => void;
/**
 * Typed event emitter.
 *
 * @example
 * ```ts
 * const emitter = new TypedEventEmitter<{ ping: number }>()
 * const off = emitter.on('ping', (value) => console.log(value))
 * emitter.emit('ping', 1) // logs 1
 * off()
 * ```
 */
export declare class TypedEventEmitter<Events extends object> {
  #private;
  /** Total number of registered listeners across all events. */
  get listenerCount(): number;
  /**
   * Subscribes to `event`.
   *
   * @returns an unsubscribe function. It is safe to call more than once.
   */
  on<EventName extends keyof Events>(event: EventName, listener: TypedEventListener<Events[EventName]>): Unsubscribe;
  /**
   * Subscribes until the first emission, then automatically unsubscribes.
   */
  once<EventName extends keyof Events>(event: EventName, listener: TypedEventListener<Events[EventName]>): Unsubscribe;
  /** Removes a previously registered listener. */
  off<EventName extends keyof Events>(event: EventName, listener: TypedEventListener<Events[EventName]>): void;
  /**
   * Synchronously invokes every listener for `event`, in subscription order.
   *
   * A throwing listener aborts the remaining listeners and propagates the error
   * to the caller; listeners are never invoked asynchronously.
   */
  emit<EventName extends keyof Events>(event: EventName, payload: Events[EventName]): void;
  /** Number of listeners registered for a single event. */
  listenerCountFor(event: keyof Events): number;
  /** Removes every listener, optionally only for one event. */
  removeAllListeners(event?: keyof Events): void;
}
//#endregion
//#region src/core/trace-pulse.d.ts
/**
 * TracePulse core instance.
 *
 * Framework-agnostic by design: no DOM, Node.js or framework imports, so the
 * exact same instance works in browsers, workers, Node, Deno and Bun.
 *
 * @example
 * ```ts
 * const pulse = new TracePulse({ name: 'app', sampleRate: 0.5 })
 * const off = pulse.on('pulse', (event) => console.log(event.name))
 *
 * pulse.start()
 * pulse.pulse('render', { ms: 12 })
 *
 * off()
 * pulse.dispose()
 * ```
 */
export declare class TracePulse implements TracePulsePluginApi {
  #private;
  /** Package version, handy for diagnostics and bug reports. */
  static readonly version: string;
  /**
   * @param options - Validated and merged with {@link DEFAULT_OPTIONS}.
   * @throws {TracePulseError} `INVALID_OPTION` when an option is invalid.
   */
  constructor(options?: TracePulseOptions);
  /** The resolved instance name. */
  get name(): string;
  /** Current lifecycle state. */
  get status(): TracePulseStatus;
  /** `true` while the instance is running. */
  get isRunning(): boolean;
  /**
   * A frozen snapshot of recorded pulses, oldest first.
   *
   * The array is a copy, so mutating it never affects the instance.
   */
  get history(): readonly PulseEvent[];
  /** The validated options this instance was created with. */
  get options(): Readonly<ResolvedTracePulseOptions>;
  /**
   * Starts recording. Idempotent.
   *
   * When the instance was created with `enabled: false` this is a no-op and
   * the status remains `"idle"`.
   *
   * @throws {TracePulseError} `INVALID_STATE` when the instance is disposed.
   */
  start(): this;
  /**
   * Stops recording. Idempotent.
   *
   * @throws {TracePulseError} `INVALID_STATE` when the instance is disposed.
   */
  stop(): this;
  /**
   * Records a pulse.
   *
   * Returns `undefined` (without throwing) when the instance is not running or
   * the pulse was sampled out. A `maxHistory` of `0` still returns and emits the
   * event; it only skips storage. The return value lets callers branch on
   * whether the pulse was actually recorded and emitted.
   *
   * @param name - Non-empty pulse name.
   * @param data - Optional plain object with user payload.
   *
   * @throws {TracePulseError} `INVALID_ARGUMENT` for invalid input.
   * @throws {TracePulseError} `INVALID_STATE` when the instance is disposed.
   */
  pulse(name: string, data?: PulseData): PulseEvent | undefined;
  /**
   * Subscribes to an instance event.
   *
   * @returns an unsubscribe function.
   * @throws {TracePulseError} `INVALID_STATE` when the instance is disposed.
   */
  on<EventName extends keyof TracePulseEventMap>(event: EventName, listener: (payload: TracePulseEventMap[EventName]) => void): Unsubscribe;
  /** Subscribes until the first emission. */
  once<EventName extends keyof TracePulseEventMap>(event: EventName, listener: (payload: TracePulseEventMap[EventName]) => void): Unsubscribe;
  /** Removes a previously registered listener. */
  off<EventName extends keyof TracePulseEventMap>(event: EventName, listener: (payload: TracePulseEventMap[EventName]) => void): void;
  /**
   * Registers a plugin.
   *
   * Plugin names are unique per instance. If `setup()` throws, the plugin is
   * rolled back and a {@link TracePulseError} with code `PLUGIN_ERROR` is thrown.
   *
   * @returns the instance, so calls can be chained.
   */
  use(plugin: TracePulsePlugin): this;
  /** Clears recorded history. */
  clearHistory(): this;
  /**
   * Disposes the instance: runs plugin teardowns in reverse order, clears
   * listeners and marks the instance as `"disposed"`. Idempotent.
   *
   * Teardown failures are reported through the `"error"` event instead of
   * being thrown, so one bad plugin cannot prevent the others from cleaning up.
   */
  dispose(): void;
}
/**
 * Convenience factory, equivalent to `new TracePulse(options)`.
 *
 * @example
 * ```ts
 * const pulse = createTracePulse({ name: 'checkout' })
 * ```
 */
export declare function createTracePulse(options?: TracePulseOptions): TracePulse;
//#endregion
//#region src/utils/guards.d.ts
/** Runtime type guards shared by the package. */
/** Returns `true` for plain objects and class instances, `false` for `null` and arrays. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** Returns `true` only for callable values. */
export declare function isFunction(value: unknown): value is (...args: never[]) => unknown;
//#endregion
//#region src/utils/id.d.ts
/**
 * Creates a collision-resistant id.
 *
 * Uses `crypto.randomUUID()` when available (browsers, workers, Node 19+,
 * Deno, Bun) and falls back to a time + random based id everywhere else.
 *
 * Pass a custom `idFactory` option if you need deterministic ids.
 */
export declare function createId(prefix?: string): string;
//#endregion
//#region src/version.d.ts
export declare const VERSION: string;
//#endregion
export type { AbortedOutcome, AbortedRequestMeasurement, ApiTotals, Clock, ColorConfig, ColorConfigInput, ColorValue, CompletedRequestMeasurement, CompletedRequestOutcome, ConsoleConfig, ConsoleConfigInput, ConsoleLevel, DurationMs, DurationThreshold, DurationThresholdInput, FailedRequestMeasurement, FailedRequestOutcome, HeadersReceivedRequestMeasurement, HttpErrorOutcome, HttpMethod, IdFactory, Monitor, MonitorConfig, MonitorConfigInput, MonotonicTimestamp, NetworkErrorOutcome, OwnershipConfig, OwnershipConfigInput, PageByteTotals, PageConfig, PageConfigInput, PageDurations, PageLoadMeasurement, PageMode, PageNavigationTiming, PageNavigationType, PagePaintTiming, PageResourceTotals, PageThresholdConfig, PageThresholdConfigInput, PendingRequestMeasurement, PulseData, PulseEvent, ReportConfig, ReportConfigInput, ReportEntry, ReportOptions, ReportOwnerSummary, ReportPage, ReportPageMetric, ReportPhase, ReportSettings, ReportSeverity, ReportStage, ReportStageSummary, ReportSummary, ReportView, RequestDurations, RequestId, RequestLifecycleState, RequestMeasurement, RequestMeasurementBase, RequestOutcome, RequestTiming, RequestTransport, ResolvedTracePulseOptions, ResponseByteTotals, ResponseBytes, ResponseMetadata, SuccessOutcome, TerminalRequestLifecycleState, ThresholdConfig, ThresholdConfigInput, TimeoutOutcome, TracePulseErrorCode, TracePulseErrorOptions, TracePulseEventMap, TracePulseOptions, TracePulsePlugin, TracePulsePluginApi, TracePulseReport, TracePulseStatus, TypedEventListener, UiTiming, Unsubscribe };