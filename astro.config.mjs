// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

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
	build: {
		format: "file",
		// Inline all CSS into the HTML. The stylesheets are a few KB;
		// as separate files they were render-blocking requests on the
		// critical path (PageSpeed flagged ~310ms of savings). Every
		// page now paints with zero CSS requests.
		inlineStylesheets: "always",
	},
	// The XML sitemap is a hand-rolled endpoint (src/pages/sitemap.xml.ts)
	// listing public pages only, so the @astrojs/sitemap plugin is not used.
	integrations: [mdx()],
	// Astro sessions are disabled: nothing on this site uses
	// Astro.session (the admin login uses its own signed cookie), so no
	// session storage — Cloudflare KV "SESSION" or any other — is set up.
	session: false,
	adapter,
});
