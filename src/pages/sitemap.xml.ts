import { getCollection } from 'astro:content';
import { SITE_URL } from '../config/site';

export const prerender = true;

// Public pages only — admin, account, checkout and auth pages are
// never listed (they are also noindex and disallowed in robots.txt).
const pages = [
	{ path: '/', changefreq: 'weekly', priority: '1.0' },
	{ path: '/pricing', changefreq: 'weekly', priority: '0.9' },
	{ path: '/download', changefreq: 'weekly', priority: '0.9' },
	{ path: '/instructions', changefreq: 'monthly', priority: '0.8' },
	{ path: '/blog', changefreq: 'weekly', priority: '0.8' },
	{ path: '/faq', changefreq: 'monthly', priority: '0.7' },
	{ path: '/about', changefreq: 'monthly', priority: '0.6' },
	{ path: '/sitemap', changefreq: 'monthly', priority: '0.5' },
	{ path: '/contact', changefreq: 'yearly', priority: '0.5' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.4' },
	{ path: '/terms', changefreq: 'yearly', priority: '0.4' },
	{ path: '/disclaimer', changefreq: 'yearly', priority: '0.4' },
];

export async function GET() {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	// Static pages carry no <lastmod>: their content has no reliable
	// per-page date, and stamping every deploy's build date would claim
	// a freshness that is not real — engines learn to ignore that.
	// Posts keep their true dates (updatedDate ?? pubDate) and declare
	// their cover image so image search can index it with the post.
	const pageUrls = pages
		.map(
			(p) => `  <url>
    <loc>${SITE_URL}${p.path === '/' ? '' : p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
		)
		.join('\n');
	const postUrls = posts
		.map(
			(post) => `  <url>
    <loc>${SITE_URL}/blog/${post.id}</loc>
    <lastmod>${(post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${
			post.data.heroImage
				? `
    <image:image>
      <image:loc>${SITE_URL}${post.data.heroImage}</image:loc>
    </image:image>`
				: ''
		}
  </url>`,
		)
		.join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pageUrls}
${postUrls}
</urlset>`;
	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
