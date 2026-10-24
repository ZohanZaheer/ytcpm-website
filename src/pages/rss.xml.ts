import { getCollection } from 'astro:content';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../config/site';

export const prerender = true;

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// RSS feed of the blog — every published post, newest first.
export async function GET() {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	const items = posts
		.map((post) => {
			const link = `${SITE_URL}/blog/${post.id}`;
			return `    <item>
      <title>${esc(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      <description>${esc(post.data.description)}</description>
    </item>`;
		})
		.join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
	});
}
