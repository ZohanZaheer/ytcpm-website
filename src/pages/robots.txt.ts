import { SITE_URL } from '../config/site';

export async function GET() {
	const txt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /pay/

Sitemap: ${SITE_URL}/sitemap.xml
`;
	return new Response(txt, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
