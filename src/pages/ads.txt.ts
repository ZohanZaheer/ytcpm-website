import { ADS_TXT } from '../config/site';

export const prerender = true;

export async function GET() {
	const content = ADS_TXT.trim();
	if (!content) {
		return new Response('Not found', { status: 404 });
	}
	return new Response(content + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
