import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/auth';
import { getDatabaseUrl } from '../../../lib/env';
import { setSupportRequestStatus } from '../../../lib/db';

export const prerender = false;

// Mark a priority support request done / reopen it.
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized', { status: 401 });
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Database is not configured.', { status: 503 });
	const form = await ctx.request.formData().catch(() => null);
	const id = String(form?.get('id') ?? '');
	const action = String(form?.get('action') ?? '');
	if (id && (action === 'done' || action === 'new')) {
		await setSupportRequestStatus(dbUrl, id, action);
	}
	return new Response(null, { status: 303, headers: { Location: '/admin/requests' } });
};
