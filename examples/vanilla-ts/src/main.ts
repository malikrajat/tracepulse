import { createMonitor } from '@codewithrajat/tracepulse'
import {
  createHtmlReport,
  createJsonReport,
  createReportView,
  downloadHtmlReport,
  installReportShortcut,
} from '@codewithrajat/tracepulse/report'

/**
 * The example stubs `fetch` before the monitor is created, so the
 * instrumentation wraps the stub instead of the native function. Real
 * applications call the native transports directly.
 */
const DELAYS: Readonly<Record<string, number>> = {
  '/api/fast': 40,
  '/api/slow': 1_200,
  '/api/error': 300,
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

const demoFetch: typeof fetch = async (input) => {
  const url = requestUrl(input)
  const delay = DELAYS[url] ?? 100

  await new Promise((resolve) => {
    setTimeout(resolve, delay)
  })

  if (url === '/api/error') {
    return new Response('service unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    })
  }

  return new Response('{"ok":true}', {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-length': '11',
    },
  })
}

globalThis.fetch = demoFetch

const monitor = createMonitor({
  report: { maxEntries: 200 },
  thresholds: {
    queueMs: { warningMs: 50, criticalMs: 100 },
    timeToResponseMs: { warningMs: 500, criticalMs: 1_000 },
    responseProcessingMs: { warningMs: 300, criticalMs: 600 },
  },
  ownership: {
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Frontend',
    serverError: 'Backend',
    failure: 'Network',
  },
})

const stopShortcut = installReportShortcut(monitor, {
  title: 'TracePulse vanilla TypeScript example',
})

function mustQuery<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (element === null) {
    throw new Error(`Example markup is missing required element: ${selector}`)
  }
  return element
}

const status = mustQuery<HTMLOutputElement>('#status')
const summary = mustQuery<HTMLParagraphElement>('#summary')
const output = mustQuery<HTMLPreElement>('#output')

function setStatus(text: string): void {
  status.textContent = text
}

function renderSummary(): void {
  const view = createReportView(monitor.getReport())
  const { bySeverity, byOwner, total } = view.summary
  const owners = byOwner.map((entry) => `${entry.owner} (${String(entry.count)})`).join(', ')

  summary.textContent = [
    `${String(total)} requests`,
    `${String(bySeverity.critical)} critical`,
    `${String(bySeverity.warning)} warning`,
    owners === '' ? 'no declared owners' : `owners: ${owners}`,
  ].join(' · ')
}

async function call(url: string): Promise<void> {
  const response = await fetch(url)
  setStatus(`${url} → ${String(response.status)} ${response.statusText}`)
  renderSummary()
}

const actions: readonly (readonly [string, string])[] = [
  ['#fast', '/api/fast'],
  ['#slow', '/api/slow'],
  ['#error', '/api/error'],
]

for (const [selector, url] of actions) {
  mustQuery<HTMLButtonElement>(selector).addEventListener('click', () => {
    void call(url)
  })
}

mustQuery<HTMLButtonElement>('#export-html').addEventListener('click', () => {
  const html = createHtmlReport(monitor.getReport(), {
    title: 'TracePulse vanilla TypeScript example',
  })
  downloadHtmlReport(html, 'tracepulse-vanilla-ts.html')
  setStatus('Downloaded tracepulse-vanilla-ts.html')
})

mustQuery<HTMLButtonElement>('#copy-json').addEventListener('click', () => {
  const json = createJsonReport(monitor.getReport())
  output.textContent = json

  const clipboard = navigator.clipboard as Clipboard | undefined
  if (clipboard !== undefined) {
    void clipboard.writeText(json)
    setStatus('JSON copied and shown below')
    return
  }

  setStatus('JSON shown below (clipboard unavailable)')
})

window.addEventListener(
  'pagehide',
  () => {
    stopShortcut()
    monitor.stop()
  },
  { once: true },
)

renderSummary()
setStatus('Make a request, then export the session. Shortcut: Ctrl/Cmd+Shift+E.')
output.textContent = 'The report is built locally; nothing is uploaded.'
