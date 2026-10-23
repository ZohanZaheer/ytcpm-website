// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";

// ── Deployment target ────────────────────────────────────────────────
// This project is NOT locked to one hosting platform. The adapter is
// chosen at build time:
//
//   DEPLOY_TARGET=cloudflare  (default)  → Cloudflare Workers
//   DEPLOY_TARGET=node                   → standalone Node server
//                                          (any VPS / local machine):
//                                          npm run build:node
//                                          npm start
//   DEPLOY_TARGET=vercel                 → Vercel (also auto-selected
//                                          when Vercel builds the repo,
//                                          because Vercel sets VERCEL=1)
//
// Everything else — environment variables (process.env), the database
// (PostgreSQL via DATABASE_URL) and screenshot storage — is already
// platform-neutral; see PAYMENTS_SETUP.md, "Running on other platforms".
const target =
	process.env.DEPLOY_TARGET ?? (process.env.VERCEL ? "vercel" : "cloudflare");

const adapter =
	target === "node"
		? node({ mode: "standalone" })
		: target === "vercel"
			? vercel()
			: // @astrojs/cloudflare v14: the old `platformProxy` option was
				// removed — the Cloudflare Vite plugin handles local proxying.
				cloudflare();

// https://astro.build/config
export default defineConfig({
	site: "https://ytcpm.cyou",
	integrations: [mdx(), sitemap()],
	adapter,
});
