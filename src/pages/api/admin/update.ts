import type { APIRoute } from 'astro';
import { getEnv, getDatabaseUrl } from '../../../lib/env';
import { setOrderStatus, type OrderStatus } from '../../../lib/db';

export const prerender = false;

// Admin action: confirm or reject an order. Protected by ADMIN_SECRET.
export const POST: APIRoute = async (ctx) => {
	const secret = getEnv(ctx, 'ADMIN_SECRET');
	const form = await ctx.request.formData().catch(() => null);
	const provided = String(form?.get('secret') ?? '');
	if (!secret || provided !== secret) {
		return new Response('Unauthorized.', { status: 401 });
	}
	const id = String(form?.get('id') ?? '');
	const status = String(form?.get('status') ?? '') as OrderStatus;
	if (!id || !['confirmed', 'rejected', 'pending'].includes(status)) {
		return new Response('Bad request.', { status: 400 });
	}
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });
	await setOrderStatus(dbUrl, id, status);
	return new Response(null, {
		status: 303,
		headers: { Location: `/admin?key=${encodeURIComponent(secret)}` },
	});
};
