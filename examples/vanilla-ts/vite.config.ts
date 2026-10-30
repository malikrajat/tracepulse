import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite-plus'

/**
 * The example imports the public package specifiers. During development they
 * resolve straight to source, mirroring the root repository config, so the
 * example runs without a prior `pnpm build`.
 *
 * A real application installs `@codewithrajat/tracepulse` and uses the
 * published `dist/` entry points instead.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@codewithrajat/tracepulse/report',
        replacement: fileURLToPath(new URL('../../src/report/index.ts', import.meta.url)),
      },
      {
        find: '@codewithrajat/tracepulse',
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
    ],
  },
})
