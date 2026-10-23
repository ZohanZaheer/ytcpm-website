import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { setOrderStatus, type OrderStatus } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/auth';

export const prerender = false;

// Admin action: confirm or reject an order. Authorized by the admin
// session cookie (email+password login) or the legacy ADMIN_SECRET.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const authed = await isAdminRequest({ ...ctx, formSecret: String(form?.get('secret') ?? '') });
	if (!authed) return new Response('Unauthorized.', { status: 401 });
	const id = String(form?.get('id') ?? '');
	const status = String(form?.get('status') ?? '') as OrderStatus;
	if (!id || !['confirmed', 'rejected', 'pending'].includes(status)) {
		return new Response('Bad request.', { status: 400 });
	}
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });
	await setOrderStatus(dbUrl, id, status);
	return new Response(null, { status: 303, headers: { Location: '/admin/orders' } });
};
