import { getCollection } from 'astro:content';
import { SITE_URL, SITE_NAME } from '../config/site';

export const prerender = true;

// llms-full.txt — the full text companion to llms.txt: the complete
// markdown of every blog post in one file, so an AI assistant can
// read and cite the articles without crawling each page. Generated
// from the content collection; new posts are included automatically.
export async function GET() {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	const postTexts = posts
		.map(
			(post) => `---

# ${post.data.title}

URL: ${SITE_URL}/blog/${post.id}
Published: ${post.data.pubDate.toISOString().slice(0, 10)}${post.data.updatedDate ? `\nUpdated: ${post.data.updatedDate.toISOString().slice(0, 10)}` : ''}

${(post.body ?? '').trim()}`,
		)
		.join('\n\n');
	const txt = `# ${SITE_NAME} — full text

> The complete text of every article on the ${SITE_NAME} blog (${SITE_URL}/blog). ${SITE_NAME} is an independent tool and is not affiliated with or endorsed by YouTube or Google. CPM and RPM figures in these articles are estimates from public sources, not guarantees of earnings. A shorter summary of the whole site lives at ${SITE_URL}/llms.txt.

${postTexts}
`;
	return new Response(txt, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
