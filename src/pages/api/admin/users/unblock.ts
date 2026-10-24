import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../../lib/env';
import { clearUserBlock } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export const prerender = false;

/**
 * Unblocks a fraud-blocked customer: clears the block and resets the
 * strike count. Fraud marks on past orders stay as history.
 */
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized.', { status: 401 });

	const form = await ctx.request.formData();

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Payments are not configured.', { status: 503 });

	const userId = String(form.get('user_id') ?? '').trim();
	if (!userId) return new Response('Missing user.', { status: 400 });

	await clearUserBlock(dbUrl, userId);
	return new Response(null, {
		status: 303,
		headers: { Location: `/admin/users/${userId}?msg=unblocked` },
	});
};
