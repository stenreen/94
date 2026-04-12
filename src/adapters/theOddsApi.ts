Run npm run scrape

> the-odds-api-collector@1.0.0 scrape
> npx tsx src/jobs/scrapeDailyOdds.ts

node:internal/modules/run_main:123

    triggerUncaughtException(
    ^
Error: Cannot find package '/home/runner/work/94/94/node_modules/zod/index.js' imported from /home/runner/work/94/94/src/adapters/theOddsApi.ts
    at legacyMainResolve (node:internal/modules/esm/resolve:215:26)
    at packageResolve (node:internal/modules/esm/resolve:860:14)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at nextResolve (node:internal/modules/esm/hooks:864:28)
    at resolveBase (file:///home/runner/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/esm/index.mjs?1776024145459:2:3744)
    at resolveDirectory (file:///home/runner/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/esm/index.mjs?1776024145459:2:4243)
    at resolveTsPaths (file:///home/runner/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/esm/index.mjs?1776024145459:2:4984)
    at resolve (file:///home/runner/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/esm/index.mjs?1776024145459:2:5361)
    at nextResolve (node:internal/modules/esm/hooks:864:28) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
Error: Process completed with exit code 1.
