import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { getOrder } from '../../../lib/db';
import { readLocalImage } from '../../../lib/storage';

export const prerender = false;

function contentTypeFor(ref: string): string {
	const ext = ref.split('.').pop()?.toLowerCase();
	return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

// Serves a stored payment screenshot to the admin only (?key=ADMIN_SECRET).
// GitHub-stored screenshots are streamed through the GitHub API with the
// configured token, so they keep working when the repository is private
// (stored download URLs would expire). Public S3/R2 URLs are redirected
// to; local files are streamed from disk (Node runtimes).
export const GET: APIRoute = async (ctx) => {
	const secret = getEnv(ctx, 'ADMIN_SECRET');
	const key = ctx.url.searchParams.get('key') ?? '';
	if (!secret || key !== secret) return new Response('Unauthorized.', { status: 401 });

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });
	const order = await getOrder(dbUrl, ctx.params.id ?? '');
	if (!order) return new Response('Order not found.', { status: 404 });

	if (order.screenshot_driver === 'github') {
		// screenshot_ref is the repo path (e.g. payment-screenshots/ord_x.png).
		// Older rows may hold a full download URL — extract the path from it.
		let path = order.screenshot_ref;
		if (path.startsWith('http')) {
			const dir = getEnv(ctx, 'GITHUB_UPLOAD_DIR') ?? 'payment-screenshots';
			const idx = path.indexOf('/' + dir + '/');
			if (idx >= 0) path = decodeURIComponent(path.slice(idx + 1).split('?')[0]);
		}
		const owner = getEnv(ctx, 'GITHUB_OWNER') ?? '';
		const repo = getEnv(ctx, 'GITHUB_REPO') ?? '';
		const branch = getEnv(ctx, 'GITHUB_BRANCH') ?? 'main';
		const res = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
			{
				headers: {
					Authorization: `Bearer ${getEnv(ctx, 'GITHUB_TOKEN') ?? ''}`,
					Accept: 'application/vnd.github.raw',
					'User-Agent': 'ytcpm-admin',
				},
			},
		);
		if (!res.ok || !res.body) {
			return new Response('Screenshot could not be loaded from GitHub storage.', { status: 502 });
		}
		return new Response(res.body, { headers: { 'Content-Type': contentTypeFor(path) } });
	}

	if (order.screenshot_ref.startsWith('http://') || order.screenshot_ref.startsWith('https://')) {
		return new Response(null, { status: 302, headers: { Location: order.screenshot_ref } });
	}
	if (order.screenshot_driver === 'local') {
		try {
			const bytes = await readLocalImage(order.screenshot_ref);
			return new Response(bytes as unknown as BodyInit, {
				headers: { 'Content-Type': contentTypeFor(order.screenshot_ref) },
			});
		} catch {
			return new Response('Screenshot file not found on this server.', { status: 404 });
		}
	}
	return new Response('Screenshot is stored in object storage; open it from your storage console.', {
		status: 200,
	});
};
