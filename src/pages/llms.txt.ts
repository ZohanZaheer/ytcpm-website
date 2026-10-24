import { SITE_URL, SITE_NAME, SUPPORT_HOURS } from '../config/site';

export const prerender = true;

// A plain-language summary of the site for AI assistants and LLMs
// (the llms.txt convention): what the product is, what it costs and
// where the authoritative pages live.
export async function GET() {
	const txt = `# ${SITE_NAME}

> ${SITE_NAME} is a standalone Windows app for YouTube CPM workflows. It runs multiple automated browsers with per-browser proxies, fingerprints and user agents, configured from one settings window. Licenses are sold on this website and paid in cryptocurrency (USDT, BTC, ETH).

${SITE_NAME} is an independent tool and is not affiliated with or endorsed by YouTube or Google. It is not installed: the customer downloads a ZIP (17 MB), extracts it and runs YoutubeCPM.exe; on first launch the app downloads its engine (up to 2.0 GB) and asks for the User ID and password issued with the license. Each running browser uses roughly 2 GB of RAM.

- Site: ${SITE_URL}
- Support: ${SUPPORT_HOURS}, via the contact page or the customer dashboard

## Pages

- [Home](${SITE_URL}): What the bot is, its features and current license prices.
- [Pricing](${SITE_URL}/pricing): License packages — 1 month, 6 months, 12 months and lifetime, for 100–500 devices, priced in USD.
- [Download](${SITE_URL}/download): Download the bot ZIP and verify the file (size and SHA-256 are published on the page).
- [Instructions](${SITE_URL}/instructions): Full setup guide — extract, sign in, and every settings tab explained (General, YouTube, Ads, Browser, Proxies).
- [Blog](${SITE_URL}/blog): Guides about YouTube CPM and RPM, proxies, browser fingerprints and user agents. CPM/RPM figures in articles are estimates from public sources, not guarantees.
- [FAQ](${SITE_URL}/faq): Payments, licenses, devices, proxies and support questions.
- [About](${SITE_URL}/about): About the bot and this site.
- [Contact](${SITE_URL}/contact): Contact form for questions and support.
- [Disclaimer](${SITE_URL}/disclaimer): Independence from YouTube/Google, estimates and user responsibility.
`;
	return new Response(txt, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
