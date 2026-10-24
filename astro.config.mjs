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
				// imageService 'passthrough': this site never uses Astro's
				// image optimization (all images are plain <img>), so the
				// Cloudflare Images "IMAGES" binding stays off.
				cloudflare({ imageService: "passthrough" });

// https://astro.build/config
export default defineConfig({
	site: "https://ytcpm.cyou",
	// Page URLs never end in a slash: /about, not /about/ (requests to
	// the slashed form redirect to the clean one). build.format
	// 'file' emits about.html instead of about/index.html so the
	// hosting asset layer serves the clean URL directly.
	trailingSlash: "never",
	build: { format: "file" },
	integrations: [
		mdx(),
		// The XML sitemap lists public pages only — admin, account,
		// checkout and auth pages stay out of search engines' way.
		sitemap({
			filter: (page) =>
				!/^\/(admin|account|pay|login|signup|404|500)(\/|$)/.test(new URL(page).pathname),
		}),
	],
	// Astro sessions are disabled: nothing on this site uses
	// Astro.session (the admin login uses its own signed cookie), so no
	// session storage — Cloudflare KV "SESSION" or any other — is set up.
	session: false,
	adapter,
});
