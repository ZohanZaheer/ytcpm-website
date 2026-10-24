import { getCollection } from 'astro:content';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../config/site';

export const prerender = true;

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Full post body as sanitized HTML for <content:encoded>: feed readers
// and aggregators can show (and index) the whole article, not just the
// summary. Relative links/images from the markdown are made absolute.
async function fullHtml(markdown: string): Promise<string> {
	const raw = await marked.parse(markdown);
	const clean = sanitizeHtml(raw, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
	});
	return clean.replace(/(href|src)="\//g, `$1="${SITE_URL}/`);
}

// RSS feed of the blog — every published post, newest first.
export async function GET() {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	const itemList = await Promise.all(
		posts.map(async (post) => {
			const link = `${SITE_URL}/blog/${post.id}`;
			const content = await fullHtml(post.body ?? '');
			return `    <item>
      <title>${esc(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      <description>${esc(post.data.description)}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
    </item>`;
		}),
	);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE_NAME} Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${SITE_URL}/og-default.jpg</url>
      <title>${SITE_NAME} Blog</title>
      <link>${SITE_URL}/blog</link>
    </image>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${itemList.join('\n')}
  </channel>
</rss>`;
	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
	});
}
