import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../lib/env';
import { setContactMessageStatus, deleteContactMessage, type ContactStatus } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/auth';

export const prerender = false;

// Admin actions for contact-form messages: mark read/new or delete.
// Authorized by the admin session cookie or the legacy ADMIN_SECRET,
// same as the order actions.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const authed = await isAdminRequest({ ...ctx, formSecret: String(form?.get('secret') ?? '') });
	if (!authed) return new Response('Unauthorized.', { status: 401 });
	const id = String(form?.get('id') ?? '');
	const action = String(form?.get('action') ?? '');
	if (!id || !['read', 'new', 'delete'].includes(action)) {
		return new Response('Bad request.', { status: 400 });
	}
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database not configured.', { status: 503 });
	if (action === 'delete') {
		await deleteContactMessage(dbUrl, id);
	} else {
		await setContactMessageStatus(dbUrl, id, action as ContactStatus);
	}
	return new Response(null, { status: 303, headers: { Location: '/admin/messages' } });
};
