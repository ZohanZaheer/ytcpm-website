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
export const ADS_TXT = `# YTCPM (ytcpm.cyou) does not sell advertising space and has no authorized digital ad sellers.`;

// ---------- Webmaster-tools verification ----------
// Paste each code; empty = the meta tag is omitted.
export const SITE_VERIFICATION = {
	google: '',
	bing: '',
	pinterest: '',
	yandex: '',
};
