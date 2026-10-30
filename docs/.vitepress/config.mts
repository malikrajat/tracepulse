import { defineConfig } from 'vitepress'

/**
 * `DOCS_BASE` is set by the docs workflow to `/<repo-name>/` so the site works
 * as a GitHub Pages project page. Locally it defaults to `/`.
 */
const base = process.env['DOCS_BASE'] ?? '/'

const description =
  'Zero-dependency request monitoring and performance observability for JavaScript and TypeScript — fetch/XHR instrumentation, warning/critical thresholds, typed events and console reporting.'

/** Core search terms mirrored from `package.json#keywords`. */
const keywords = [
  'tracepulse',
  'request monitoring',
  'performance monitoring',
  'observability',
  'apm',
  'telemetry',
  'tracing',
  'fetch',
  'xhr',
  'xmlhttprequest',
  'instrumentation',
  'interceptors',
  'http',
  'api monitoring',
  'latency',
  'response time',
  'ttfb',
  'thresholds',
  'console reporting',
  'typescript',
  'javascript',
  'zero dependency',
  'lightweight',
  'browser',
  'node',
  'deno',
  'bun',
  'edge runtime',
  'react',
  'vue',
  'svelte',
  'angular',
  'package',
].join(', ')

export default defineConfig({
  title: 'TracePulse',
  description,
  base,
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  head: [
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'author', content: 'Rajat Malik' }],
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'TracePulse — request monitoring and performance observability',
      },
    ],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  sitemap: {
    hostname: 'https://malikrajat.github.io/tracepulse/',
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/guide/api' },
      {
        text: 'Support',
        items: [
          { text: 'Email support', link: 'mailto:support@theraterajatmalik.dev' },
          { text: 'GitHub issues', link: 'https://github.com/malikrajat/tracepulse/issues' },
          {
            text: 'Security policy',
            link: 'https://github.com/malikrajat/tracepulse/blob/main/SECURITY.md',
          },
        ],
      },
      {
        text: 'v1.0.0',
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/malikrajat/tracepulse/blob/main/CHANGELOG.md',
          },
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/@codewithrajat/tracepulse',
          },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Threshold pairs', link: '/guide/migration' },
            { text: 'Core concepts', link: '/guide/core-concepts' },
            { text: 'Plugins', link: '/guide/plugins' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Scope and protocols', link: '/guide/scope' },
            { text: 'Measurement model', link: '/guide/measurement-model' },
            { text: 'Reporting', link: '/guide/reporting' },
            { text: 'API', link: '/guide/api' },
          ],
        },
        {
          text: 'Project',
          items: [
            { text: 'Publishing', link: '/guide/publishing' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/malikrajat/tracepulse' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/malikrajat/tracepulse/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Rajat Malik · support@theraterajatmalik.dev',
    },

    outline: { level: [2, 3], label: 'On this page' },
  },
})
