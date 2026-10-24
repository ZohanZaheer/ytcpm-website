# CLAUDE.md — ytcpm-website

See [`AGENTS.md`](AGENTS.md) for stack, conventions, single sources of
truth and push rules. Quick reference:

- `npm run dev` — local dev server
- `npm run build` — production build (Cloudflare target);
  `npm run build:node` / `npm run build:vercel` for the other targets
- `npx wrangler dev -c dist/server/wrangler.json` — production-like
  local run (uses `dist/server/.dev.vars` for env)
- `npm run check` — build + typecheck + wrangler dry-run
- SSR Astro site (not static) — PostgreSQL + better-auth; deploys:
  Cloudflare Workers (primary), Node, Vercel ([`vercel.json`](vercel.json))
- Config map: [`.env.example`](.env.example) (env vars),
  [`PAYMENTS_SETUP.md`](PAYMENTS_SETUP.md) (payments/accounts setup),
  `src/config/site.ts` (SEO/discovery)
