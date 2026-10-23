import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getOrder } from '../../../lib/db';
import { readLocalImage } from '../../../lib/storage';

export const prerender = false;

// Serves a stored payment screenshot to the admin only (?key=ADMIN_SECRET).
// Remote stores (S3/R2/GitHub) are redirected to their URL; local files
// are streamed from disk (Node runtimes).
export const GET: APIRoute = async (ctx) => {
	const secret = getEnv(ctx, 'ADMIN_SECRET');
	const key = ctx.url.searchParams.get('key') ?? '';
	if (!secret || key !== secret) return new Response('Unauthorized.', { status: 401 });

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });
	const order = await getOrder(dbUrl, ctx.params.id ?? '');
	if (!order) return new Response('Order not found.', { status: 404 });

	if (order.screenshot_ref.startsWith('http://') || order.screenshot_ref.startsWith('https://')) {
		return new Response(null, { status: 302, headers: { Location: order.screenshot_ref } });
	}
	if (order.screenshot_driver === 'local') {
		try {
			const bytes = await readLocalImage(order.screenshot_ref);
			const ext = order.screenshot_ref.split('.').pop()?.toLowerCase();
			const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
			return new Response(bytes as unknown as BodyInit, { headers: { 'Content-Type': type } });
		} catch {
			return new Response('Screenshot file not found on this server.', { status: 404 });
		}
	}
	return new Response('Screenshot is stored in object storage; open it from your storage console.', {
		status: 200,
	});
};
