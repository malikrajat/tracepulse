# Troubleshooting

## `Cannot find module '@codewithrajat/tracepulse'` in the playground

The playground aliases the package to `src/index.ts` through the `resolve.alias` entry
in `vite.config.ts`. Make sure you run `pnpm dev` (`vp dev`) rather than a bare `vite`
command.

## TypeScript cannot find types after installing from a local tarball

Install with the tarball path and check that the `exports` map resolves:

```bash
pnpm pack
pnpm add ./codewithrajat-tracepulse-1.0.0.tgz
```

Then verify resolution from a consumer's perspective:

```bash
pnpm run check:types   # attw --pack . --profile node16
```

If you renamed the package, update `package.json#exports` consistently — the `types`,
`import` and `require` branches must all point at files that exist.

## `403 Forbidden` when publishing

The npm scope does not belong to the publishing account. See
[Publishing → Confirm the npm scope](/guide/publishing#_1-confirm-the-npm-scope).

## `ERR_PNPM_IGNORED_BUILDS`

pnpm 10+ blocks postinstall scripts by default. This repository approves `esbuild`
(used by VitePress) in `pnpm-workspace.yaml`. If a new tool needs a build script:

```bash
pnpm approve-builds
```

and commit the resulting `pnpm-workspace.yaml` change.

## Coverage thresholds fail

Thresholds live in the `test.coverage` block of `vite.config.ts` (90%
statements/lines/functions, 85% branches). Add a focused test rather than lowering the
threshold. `pnpm test:coverage` prints the exact uncovered lines.

## Git hooks do not run

Vite+ owns the hooks dispatcher; `pnpm install` runs `vp config --no-agent`.

```bash
vp hooks status              # preference, dispatcher and core.hooksPath
git config core.hooksPath    # should print .vite-hooks/_
vp hooks enable              # (re)install the dispatcher
```

The project-owned hook is `.vite-hooks/pre-commit`, which runs `vp staged`. Staged-file
checks are configured in the `staged` block of `vite.config.ts`.

To skip hooks for one commit, set `VP_GIT_HOOKS=0`.

## `INVALID_STATE` thrown unexpectedly

`TracePulseError` with code `INVALID_STATE` has two documented causes:

- A `TracePulse` instance was used after `dispose()`. Disposal is terminal by design;
  create a new instance instead of reusing a disposed one.
- A second monitor was started while another monitor is already running in this loaded
  module instance. Call `stop()` on the running monitor first. Idle and disabled monitors do
  not claim the active slot.

The monitor guard is per loaded module instance; duplicate package copies and separate
realms are not globally coordinated.

## ESM/CJS interop issues

The package ships both formats with separate declaration files:

| Consumer   | JavaScript                  | Types              |
| ---------- | --------------------------- | ------------------ |
| `import`   | `dist/index.js`             | `dist/index.d.ts`  |
| `require`  | `dist/index.cjs`            | `dist/index.d.cts` |
| `<script>` | `dist/index.iife.global.js` | —                  |

If a bundler picks the wrong branch, check its `exports` condition support. Node 18+,
Vite, webpack 5 and esbuild all handle this map correctly.

## `vp check` reports TypeScript 7 warnings

tsdown prints `TypeScript 7.0 does not yet have a stable API` while generating
declarations. This is expected: TS 7 support is experimental upstream, the build still
succeeds, and the emitted `.d.ts`/`.d.cts` remain compatible with TypeScript 4.7+.

## Docs build fails on a dead link

VitePress fails the build for broken internal links. Fix the link or add a pattern to
`ignoreDeadLinks` in `docs/.vitepress/config.mts`. The API reference is now a normal
Markdown page (`docs/guide/api.md`), so there is no generated-content exception.
