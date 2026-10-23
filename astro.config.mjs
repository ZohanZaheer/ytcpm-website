// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
	site: "https://ytcpm.cyou",
	integrations: [mdx(), sitemap()],
	// @astrojs/cloudflare v14: the old `platformProxy` option was removed —
	// local dev/preview proxying is handled by the Cloudflare Vite plugin.
	adapter: cloudflare(),
});
