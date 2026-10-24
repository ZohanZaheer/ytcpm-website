/**
 * YTCPM — single source of truth for site-wide SEO / discovery data:
 * canonical URLs, structured data, the .txt/.xml endpoints
 * (robots.txt, ads.txt, llms.txt, sitemap.xml, rss.xml) and webmaster
 * verification. Edit here and every consumer updates.
 */

// ---------- Site ----------
export const SITE_URL = 'https://ytcpm.cyou';
export const SITE_NAME = 'YTCPM Bot';
export const SITE_ORGANIZATION = 'YTCPM';
export const SITE_DESCRIPTION =
	'YTCPM Bot is a standalone Windows app for YouTube CPM workflows — multi-browser automation with proxy, fingerprint and user-agent controls. Download, pricing and setup guide.';
export const SITE_OG_IMAGE = `${SITE_URL}/og-default.jpg`;
export const SITE_LOCALE = 'en_US';
export const SUPPORT_HOURS = '6 days a week, 10:00 AM–6:00 PM New York time';
/** Stable @id of the publisher Organization node in the JSON-LD graph. */
export const ORG_ID = `${SITE_URL}/#org`;

// ---------- Author ----------
export const AUTHOR_NAME = 'Zaheer Ahmad';

// ---------- ads.txt ----------
// This site sells no advertising space, so the file declares that
// there are no authorized digital ad sellers. If ad networks are
// ever added, their lines go here (one per line).
//export const ADS_TXT = `# YTCPM (ytcpm.cyou) does not sell advertising space and has no authorized digital ad sellers.`;
export const ADS_TXT = `google.com, pub-1802003890783048, DIRECT, f08c47fec0942fa0`;

// ---------- Google AdSense ----------
// Publisher client ID (looks like "ca-pub-XXXXXXXXXXXXXXXX") from
// AdSense → Account → Settings → Account information. Empty = the
// AdSense script is not loaded. BaseHead puts the script in the head
// of every public page (never on admin/account/checkout/auth pages).
// NOTE: the ads.txt line in ADS_TXT above must carry the SAME
// publisher number, or AdSense cannot verify the site.
export const ADSENSE_CLIENT_ID = 'ca-pub-1802003890783048';

// ---------- Webmaster-tools verification ----------
// Paste each code; empty = the meta tag is omitted.
export const SITE_VERIFICATION = {
	google: 'DrczNACCe8O46okdHlRXDwvfUPskYV3IIHXuerDlFEA',
	bing: 'C36695046B1ACEE33EBE6D14A4C3C229',
	pinterest: 'e47b58eef760f5a391a3a56ab248cb13',
	yandex: '',
};

// ---------- Google Analytics (GA4) ----------
// Paste the Measurement ID from GA → Admin → Data Streams → the web
// stream (looks like "G-XXXXXXXXXX"). Empty = analytics is disabled.
// Loaded on public pages only (never on admin/account/checkout/auth).
export const GA_MEASUREMENT_ID = 'G-NCM400NB7C';
