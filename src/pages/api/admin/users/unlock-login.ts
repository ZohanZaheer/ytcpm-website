import type { APIRoute } from 'astro';
import { getDatabaseUrl } from '../../../../lib/env';
import { clearLoginLock } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export const prerender = false;

/** Admin action: lift a customer's login lockout immediately and reset
 * the failed-attempt counters. */
export const POST: APIRoute = async (ctx) => {
	if (!(await isAdminRequest(ctx))) return new Response('Unauthorized.', { status: 401 });

	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return new Response('Payments are not configured.', { status: 503 });

	const form = await ctx.request.formData();
	const userId = String(form.get('user_id') ?? '').trim();
	if (!userId) return new Response('Missing user.', { status: 400 });

	await clearLoginLock(dbUrl, userId);
	return new Response(null, {
		status: 303,
		headers: { Location: `/admin/users/${userId}?msg=unlocked` },
	});
};
